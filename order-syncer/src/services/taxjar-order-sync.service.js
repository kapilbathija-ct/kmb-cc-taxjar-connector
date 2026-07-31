import { centsToDecimal } from '../utils/money.util.js';

function firstLocalizedValue(localizedString) {
  return Object.values(localizedString || {})[0];
}

function toTaxJarOrderLineItem(lineItem) {
  const unitPriceCents = lineItem.price.value.centAmount;
  const unitPriceFractionDigits = lineItem.price.value.fractionDigits;
  const unitPrice = centsToDecimal(unitPriceCents, unitPriceFractionDigits);
  const undiscountedTotal = unitPrice * lineItem.quantity;
  const actualTotal = centsToDecimal(
    lineItem.totalPrice.centAmount,
    lineItem.totalPrice.fractionDigits
  );
  const discount = Math.max(
    0,
    Number((undiscountedTotal - actualTotal).toFixed(2))
  );

  return {
    id: lineItem.id,
    quantity: lineItem.quantity,
    product_identifier: lineItem.variant?.sku || lineItem.productId,
    description:
      firstLocalizedValue(lineItem.name) || lineItem.productId || lineItem.id,
    unit_price: unitPrice,
    discount,
    sales_tax: centsToDecimal(
      lineItem.taxedPrice?.totalTax?.centAmount || 0,
      lineItem.totalPrice.fractionDigits
    ),
  };
}

/**
 * Builds the request body for TaxJar's `createOrder` ("Create order
 * transaction") call, from a placed Order whose tax was already calculated
 * via the tax-calculator's ExternalAmount Cart Extension. This records the
 * finalized sale with TaxJar for its own reporting/filing, separate from the
 * earlier tax-calculation step.
 *
 * Returns `null` when the Order has no taxedPrice yet (e.g. taxMode isn't
 * ExternalAmount, or the Cart extension didn't run) - nothing to report.
 */
export function buildTaxJarOrderPayload(order, config) {
  if (!order.taxedPrice || !order.shippingAddress?.country) {
    return null;
  }

  const currencyFractionDigits = order.taxedPrice.totalGross.fractionDigits;
  const lineItemsSubtotal = (order.lineItems || []).reduce(
    (sum, lineItem) =>
      sum +
      centsToDecimal(
        lineItem.totalPrice.centAmount,
        lineItem.totalPrice.fractionDigits
      ),
    0
  );
  const shipping = order.shippingInfo?.price
    ? centsToDecimal(
        order.shippingInfo.price.centAmount,
        order.shippingInfo.price.fractionDigits
      )
    : 0;
  const salesTax = centsToDecimal(
    order.taxedPrice.totalTax?.centAmount || 0,
    currencyFractionDigits
  );

  return {
    transaction_id: order.orderNumber || order.id,
    transaction_date: (order.createdAt || '').slice(0, 10),
    from_country: config.taxjarFromCountry,
    from_state: config.taxjarFromState,
    ...(config.taxjarFromZip ? { from_zip: config.taxjarFromZip } : {}),
    to_country: order.shippingAddress.country,
    to_state: order.shippingAddress.state || undefined,
    to_zip: order.shippingAddress.postalCode || undefined,
    to_city: order.shippingAddress.city || undefined,
    // TaxJar's createOrder ("order transaction") endpoint requires `amount`
    // to equal line items + shipping combined - unlike the taxForOrder rate
    // endpoint, where `amount` excludes shipping. Confirmed via its own
    // validation error: "Order amount must be equal to the sum of line
    // items and shipping".
    amount: Number((lineItemsSubtotal + shipping).toFixed(2)),
    shipping: Number(shipping.toFixed(2)),
    sales_tax: salesTax,
    line_items: (order.lineItems || []).map(toTaxJarOrderLineItem),
  };
}
