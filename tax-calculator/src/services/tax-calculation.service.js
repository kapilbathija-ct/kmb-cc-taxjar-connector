import { centsToDecimal, decimalToCents } from '../utils/money.util.js';
import CustomError from '../errors/custom.error.js';
import { HTTP_STATUS_BAD_REQUEST } from '../constants/http.status.constants.js';

const TAXJAR_PRODUCT_TAX_CODE_ATTRIBUTE = 'taxjarProductTaxCode';
const TAX_DETAIL_TYPE_KEY = 'taxjar-line-item-tax-detail';
const NO_NEXUS_TAX_RATE_NAME = 'No Tax (Out of Nexus)';

function getProductTaxCode(lineItem) {
  const attribute = (lineItem.variant?.attributes || []).find(
    (attr) => attr.name === TAXJAR_PRODUCT_TAX_CODE_ATTRIBUTE
  );
  return attribute?.value || undefined;
}

/**
 * TaxJar wants the line's undiscounted unit price plus a single "discount"
 * amount, not a pre-discounted unit price - derive the discount from the
 * gap between quantity*unitPrice and the Cart's already-discounted totalPrice.
 */
function toTaxJarLineItem({
  id,
  quantity,
  unitPriceCents,
  unitPriceFractionDigits,
  totalPriceCents,
  totalPriceFractionDigits,
  productTaxCode,
}) {
  const unitPrice = centsToDecimal(unitPriceCents, unitPriceFractionDigits);
  const undiscountedTotal = unitPrice * quantity;
  const actualTotal = centsToDecimal(totalPriceCents, totalPriceFractionDigits);
  const discount = Math.max(
    0,
    Number((undiscountedTotal - actualTotal).toFixed(2))
  );

  const payload = { id, quantity, unit_price: unitPrice, discount };
  if (productTaxCode) {
    payload.product_tax_code = productTaxCode;
  }
  return payload;
}

function lineItemToTaxJarPayload(lineItem) {
  return toTaxJarLineItem({
    id: lineItem.id,
    quantity: lineItem.quantity,
    unitPriceCents: lineItem.price.value.centAmount,
    unitPriceFractionDigits: lineItem.price.value.fractionDigits,
    totalPriceCents: lineItem.totalPrice.centAmount,
    totalPriceFractionDigits: lineItem.totalPrice.fractionDigits,
    productTaxCode: getProductTaxCode(lineItem),
  });
}

function customLineItemToTaxJarPayload(customLineItem) {
  return toTaxJarLineItem({
    id: customLineItem.id,
    quantity: customLineItem.quantity,
    unitPriceCents: customLineItem.money.centAmount,
    unitPriceFractionDigits: customLineItem.money.fractionDigits,
    totalPriceCents: customLineItem.totalPrice.centAmount,
    totalPriceFractionDigits: customLineItem.totalPrice.fractionDigits,
  });
}

/**
 * Builds the request body for TaxJar's POST /v2/taxes ("Calculate sales tax
 * for an order"), from the frozen Cart that triggered the API Extension.
 */
export function buildTaxJarRequest(cart, config) {
  const { shippingAddress } = cart;
  if (!shippingAddress?.country) {
    throw new CustomError(
      HTTP_STATUS_BAD_REQUEST,
      'Cart is missing a shippingAddress with a country - cannot calculate tax.'
    );
  }
  if (!shippingAddress?.postalCode) {
    throw new CustomError(
      HTTP_STATUS_BAD_REQUEST,
      'Cart shippingAddress is missing a postalCode - cannot calculate tax accurately.'
    );
  }

  const shippingCents = cart.shippingInfo?.price?.centAmount || 0;
  const shippingFractionDigits = cart.shippingInfo?.price?.fractionDigits ?? 2;

  const lineItems = [
    ...(cart.lineItems || []).map(lineItemToTaxJarPayload),
    ...(cart.customLineItems || []).map(customLineItemToTaxJarPayload),
  ];

  return {
    from_country: config.taxjarFromCountry,
    from_state: config.taxjarFromState,
    ...(config.taxjarFromZip ? { from_zip: config.taxjarFromZip } : {}),
    to_country: shippingAddress.country,
    to_state: shippingAddress.state || undefined,
    to_zip: shippingAddress.postalCode,
    to_city: shippingAddress.city || undefined,
    shipping: centsToDecimal(shippingCents, shippingFractionDigits),
    line_items: lineItems,
  };
}

function buildExternalTaxRate({ hasNexus, itemBreakdown, toCountry, toState }) {
  if (!hasNexus || !itemBreakdown) {
    return {
      name: NO_NEXUS_TAX_RATE_NAME,
      amount: 0,
      country: toCountry,
      state: toState,
      includedInPrice: false,
    };
  }

  return {
    name: `TaxJar Combined Rate (${toState || toCountry})`,
    amount: itemBreakdown.combined_tax_rate || 0,
    country: toCountry,
    state: toState,
    includedInPrice: false,
    subRates: [
      { name: 'State', amount: itemBreakdown.state_sales_tax_rate || 0 },
      { name: 'County', amount: itemBreakdown.county_tax_rate || 0 },
      { name: 'City', amount: itemBreakdown.city_tax_rate || 0 },
      { name: 'Special District', amount: itemBreakdown.special_tax_rate || 0 },
    ],
  };
}

function buildTaxDetailFields(itemBreakdown) {
  return {
    taxjarTaxableAmount: itemBreakdown.taxable_amount || 0,
    taxjarTaxCollectable: itemBreakdown.tax_collectable || 0,
    taxjarCombinedTaxRate: itemBreakdown.combined_tax_rate || 0,
    taxjarStateAmount: itemBreakdown.state_amount || 0,
    taxjarCountyAmount: itemBreakdown.county_amount || 0,
    taxjarCityAmount: itemBreakdown.city_amount || 0,
    taxjarSpecialDistrictAmount: itemBreakdown.special_district_amount || 0,
  };
}

/**
 * Maps a TaxJar `taxForOrder` result back onto the Cart as commercetools
 * update actions, per the ExternalAmount tax mode contract: every Line Item /
 * Custom Line Item / Shipping Method gets its own setXTaxAmount action, and
 * the Cart's overall taxedPrice is finalized with setCartTotalTax.
 *
 * Also stamps the real per-jurisdiction dollar breakdown (state/county/city/
 * special district) onto each Line Item via the `taxjar-line-item-tax-detail`
 * custom Type, since native TaxRate/SubRate only carries rates, not amounts.
 */
export function buildCartUpdateActions(cart, taxJarResult) {
  const tax = taxJarResult.tax;
  const hasNexus = Boolean(tax.has_nexus);
  const breakdown = tax.breakdown;
  const currencyCode = cart.totalPrice.currencyCode;
  const toCountry = cart.shippingAddress.country;
  const toState = cart.shippingAddress.state;

  const lineItemBreakdownById = new Map(
    (breakdown?.line_items || []).map((item) => [item.id, item])
  );

  const actions = [];
  let totalGrossCents = 0;

  for (const lineItem of cart.lineItems || []) {
    const itemBreakdown = lineItemBreakdownById.get(lineItem.id);
    const netCents = lineItem.totalPrice.centAmount;
    const taxCents = itemBreakdown
      ? decimalToCents(
          itemBreakdown.tax_collectable,
          lineItem.totalPrice.fractionDigits
        )
      : 0;
    const grossCents = netCents + taxCents;

    actions.push({
      action: 'setLineItemTaxAmount',
      lineItemId: lineItem.id,
      externalTaxAmount: {
        totalGross: { currencyCode, centAmount: grossCents },
        taxRate: buildExternalTaxRate({
          hasNexus,
          itemBreakdown,
          toCountry,
          toState,
        }),
      },
    });

    if (itemBreakdown) {
      actions.push({
        action: 'setLineItemCustomType',
        lineItemId: lineItem.id,
        type: { typeId: 'type', key: TAX_DETAIL_TYPE_KEY },
        fields: buildTaxDetailFields(itemBreakdown),
      });
    }

    totalGrossCents += grossCents;
  }

  for (const customLineItem of cart.customLineItems || []) {
    const itemBreakdown = lineItemBreakdownById.get(customLineItem.id);
    const netCents = customLineItem.totalPrice.centAmount;
    const taxCents = itemBreakdown
      ? decimalToCents(
          itemBreakdown.tax_collectable,
          customLineItem.totalPrice.fractionDigits
        )
      : 0;
    const grossCents = netCents + taxCents;

    actions.push({
      action: 'setCustomLineItemTaxAmount',
      customLineItemId: customLineItem.id,
      externalTaxAmount: {
        totalGross: { currencyCode, centAmount: grossCents },
        taxRate: buildExternalTaxRate({
          hasNexus,
          itemBreakdown,
          toCountry,
          toState,
        }),
      },
    });

    totalGrossCents += grossCents;
  }

  // Single-shipping-method Carts use `shippingInfo`; `Multiple` mode uses the
  // `shipping` array instead. TaxJar only returns one shipping breakdown per
  // call, so for `Multiple` mode the same combined rate is applied to every
  // shipping method - accurate as long as all methods ship to the same
  // destination, which is the common case for this Cart's tax freeze point.
  const shippingEntries = cart.shippingInfo
    ? [{ shippingInfo: cart.shippingInfo, shippingKey: undefined }]
    : (cart.shipping || []).map((s) => ({
        shippingInfo: s.shippingInfo,
        shippingKey: s.shippingKey,
      }));

  for (const { shippingInfo, shippingKey } of shippingEntries) {
    if (!shippingInfo?.price) continue;

    const netCents = shippingInfo.price.centAmount;
    const taxCents = breakdown?.shipping
      ? decimalToCents(
          breakdown.shipping.tax_collectable,
          shippingInfo.price.fractionDigits
        )
      : 0;
    const grossCents = netCents + taxCents;

    actions.push({
      action: 'setShippingMethodTaxAmount',
      ...(shippingKey ? { shippingKey } : {}),
      externalTaxAmount: {
        totalGross: { currencyCode, centAmount: grossCents },
        taxRate: buildExternalTaxRate({
          hasNexus,
          itemBreakdown: breakdown?.shipping,
          toCountry,
          toState,
        }),
      },
    });

    totalGrossCents += grossCents;
  }

  const externalTaxPortions = [];
  if (breakdown) {
    const portionDefs = [
      {
        name: 'State',
        rateKey: 'state_tax_rate',
        amountKey: 'state_tax_collectable',
      },
      {
        name: 'County',
        rateKey: 'county_tax_rate',
        amountKey: 'county_tax_collectable',
      },
      {
        name: 'City',
        rateKey: 'city_tax_rate',
        amountKey: 'city_tax_collectable',
      },
      {
        name: 'Special District',
        rateKey: 'special_tax_rate',
        amountKey: 'special_district_tax_collectable',
      },
    ];
    for (const { name, rateKey, amountKey } of portionDefs) {
      const amount = breakdown[amountKey];
      if (amount) {
        externalTaxPortions.push({
          name,
          rate: breakdown[rateKey] || 0,
          amount: {
            currencyCode,
            centAmount: decimalToCents(amount, cart.totalPrice.fractionDigits),
          },
        });
      }
    }
  }

  actions.push({
    action: 'setCartTotalTax',
    externalTotalGross: { currencyCode, centAmount: totalGrossCents },
    externalTaxPortions,
  });

  return actions;
}
