import { expect, describe, it } from '@jest/globals';
import {
  buildTaxJarRequest,
  buildCartUpdateActions,
} from '../../src/services/tax-calculation.service.js';

const config = {
  taxjarFromCountry: 'US',
  taxjarFromState: 'NC',
};

function buildCart(overrides = {}) {
  return {
    totalPrice: { currencyCode: 'USD', centAmount: 7500, fractionDigits: 2 },
    shippingAddress: {
      country: 'US',
      state: 'NC',
      postalCode: '27701',
      city: 'Durham',
    },
    shippingInfo: {
      price: { currencyCode: 'USD', centAmount: 500, fractionDigits: 2 },
    },
    lineItems: [
      {
        id: 'line1',
        quantity: 2,
        price: {
          value: { currencyCode: 'USD', centAmount: 1500, fractionDigits: 2 },
        },
        totalPrice: { currencyCode: 'USD', centAmount: 3000, fractionDigits: 2 },
        variant: {
          attributes: [{ name: 'taxjarProductTaxCode', value: '99000000A0000' }],
        },
      },
      {
        id: 'line2',
        quantity: 1,
        price: {
          value: { currencyCode: 'USD', centAmount: 4000, fractionDigits: 2 },
        },
        totalPrice: { currencyCode: 'USD', centAmount: 4000, fractionDigits: 2 },
        variant: { attributes: [] },
      },
    ],
    customLineItems: [],
    ...overrides,
  };
}

describe('tax-calculation.service', () => {
  describe('buildTaxJarRequest', () => {
    it('builds a valid TaxJar taxForOrder payload from a Cart', () => {
      const request = buildTaxJarRequest(buildCart(), config);

      expect(request).toEqual({
        from_country: 'US',
        from_state: 'NC',
        to_country: 'US',
        to_state: 'NC',
        to_zip: '27701',
        to_city: 'Durham',
        shipping: 5,
        line_items: [
          {
            id: 'line1',
            quantity: 2,
            unit_price: 15,
            discount: 0,
            product_tax_code: '99000000A0000',
          },
          { id: 'line2', quantity: 1, unit_price: 40, discount: 0 },
        ],
      });
    });

    it('derives the TaxJar discount amount from a discounted totalPrice', () => {
      const cart = buildCart({
        lineItems: [
          {
            id: 'line3',
            quantity: 2,
            price: {
              value: { currencyCode: 'USD', centAmount: 2000, fractionDigits: 2 },
            },
            // Undiscounted total would be $40; Cart discount brought it to $36.
            totalPrice: { currencyCode: 'USD', centAmount: 3600, fractionDigits: 2 },
            variant: { attributes: [] },
          },
        ],
      });

      const request = buildTaxJarRequest(cart, config);

      expect(request.line_items[0]).toEqual({
        id: 'line3',
        quantity: 2,
        unit_price: 20,
        discount: 4,
      });
    });

    it('throws a 400 CustomError when shippingAddress is missing', () => {
      const cart = buildCart({ shippingAddress: undefined });
      expect(() => buildTaxJarRequest(cart, config)).toThrow(
        /shippingAddress/
      );
    });

    it('throws a 400 CustomError when shippingAddress has no postalCode', () => {
      const cart = buildCart({
        shippingAddress: { country: 'US', state: 'NC' },
      });
      expect(() => buildTaxJarRequest(cart, config)).toThrow(/postalCode/);
    });
  });

  describe('buildCartUpdateActions', () => {
    const nexusTaxJarResult = {
      tax: {
        has_nexus: true,
        breakdown: {
          line_items: [
            {
              id: 'line1',
              tax_collectable: 2.25,
              taxable_amount: 30,
              combined_tax_rate: 0.075,
              state_sales_tax_rate: 0.0475,
              county_tax_rate: 0.0225,
              city_tax_rate: 0,
              special_tax_rate: 0.005,
              state_amount: 1.43,
              county_amount: 0.68,
              city_amount: 0,
              special_district_amount: 0.15,
            },
            {
              id: 'line2',
              tax_collectable: 3.0,
              taxable_amount: 40,
              combined_tax_rate: 0.075,
              state_sales_tax_rate: 0.0475,
              county_tax_rate: 0.0225,
              city_tax_rate: 0,
              special_tax_rate: 0.005,
              state_amount: 1.9,
              county_amount: 0.9,
              city_amount: 0,
              special_district_amount: 0.2,
            },
          ],
          shipping: {
            tax_collectable: 0.38,
            combined_tax_rate: 0.075,
            state_sales_tax_rate: 0.0475,
            county_tax_rate: 0.0225,
            city_tax_rate: 0,
            special_tax_rate: 0.005,
          },
          tax_collectable: 5.63,
          state_tax_rate: 0.0475,
          state_tax_collectable: 3.56,
          county_tax_rate: 0.0225,
          county_tax_collectable: 1.69,
          city_tax_rate: 0,
          city_tax_collectable: 0,
          special_tax_rate: 0.005,
          special_district_tax_collectable: 0.38,
        },
      },
    };

    it('builds setLineItemTaxAmount + setLineItemCustomType + setShippingMethodTaxAmount + setCartTotalTax when the destination has nexus', () => {
      const actions = buildCartUpdateActions(buildCart(), nexusTaxJarResult);

      expect(actions).toContainEqual({
        action: 'setLineItemTaxAmount',
        lineItemId: 'line1',
        externalTaxAmount: {
          totalGross: { currencyCode: 'USD', centAmount: 3225 },
          taxRate: {
            name: 'TaxJar Combined Rate (NC)',
            amount: 0.075,
            country: 'US',
            state: 'NC',
            includedInPrice: false,
            subRates: [
              { name: 'State', amount: 0.0475 },
              { name: 'County', amount: 0.0225 },
              { name: 'City', amount: 0 },
              { name: 'Special District', amount: 0.005 },
            ],
          },
        },
      });

      expect(actions).toContainEqual({
        action: 'setLineItemCustomType',
        lineItemId: 'line1',
        type: { typeId: 'type', key: 'taxjar-line-item-tax-detail' },
        fields: {
          taxjarTaxableAmount: 30,
          taxjarTaxCollectable: 2.25,
          taxjarCombinedTaxRate: 0.075,
          taxjarStateAmount: 1.43,
          taxjarCountyAmount: 0.68,
          taxjarCityAmount: 0,
          taxjarSpecialDistrictAmount: 0.15,
        },
      });

      expect(actions).toContainEqual({
        action: 'setLineItemTaxAmount',
        lineItemId: 'line2',
        externalTaxAmount: {
          totalGross: { currencyCode: 'USD', centAmount: 4300 },
          taxRate: expect.objectContaining({ amount: 0.075 }),
        },
      });

      expect(actions).toContainEqual({
        action: 'setShippingMethodTaxAmount',
        externalTaxAmount: {
          totalGross: { currencyCode: 'USD', centAmount: 538 },
          taxRate: expect.objectContaining({ amount: 0.075 }),
        },
      });

      const setCartTotalTax = actions.find(
        (a) => a.action === 'setCartTotalTax'
      );
      expect(setCartTotalTax.externalTotalGross).toEqual({
        currencyCode: 'USD',
        centAmount: 3225 + 4300 + 538,
      });
      expect(setCartTotalTax.externalTaxPortions).toEqual(
        expect.arrayContaining([
          { name: 'State', rate: 0.0475, amount: { currencyCode: 'USD', centAmount: 356 } },
          { name: 'County', rate: 0.0225, amount: { currencyCode: 'USD', centAmount: 169 } },
          { name: 'Special District', rate: 0.005, amount: { currencyCode: 'USD', centAmount: 38 } },
        ])
      );
      // Zero-amount jurisdictions (City here) are omitted, not sent as $0 portions.
      expect(
        setCartTotalTax.externalTaxPortions.find((p) => p.name === 'City')
      ).toBeUndefined();
    });

    it('sets a zero-amount "No Tax (Out of Nexus)" rate and skips custom-type actions when the destination is out of nexus', () => {
      const outOfNexusResult = { tax: { has_nexus: false } };
      const actions = buildCartUpdateActions(buildCart(), outOfNexusResult);

      expect(actions).toContainEqual({
        action: 'setLineItemTaxAmount',
        lineItemId: 'line1',
        externalTaxAmount: {
          totalGross: { currencyCode: 'USD', centAmount: 3000 },
          taxRate: {
            name: 'No Tax (Out of Nexus)',
            amount: 0,
            country: 'US',
            state: 'NC',
            includedInPrice: false,
          },
        },
      });

      expect(
        actions.some((a) => a.action === 'setLineItemCustomType')
      ).toBe(false);

      const setCartTotalTax = actions.find(
        (a) => a.action === 'setCartTotalTax'
      );
      expect(setCartTotalTax.externalTotalGross).toEqual({
        currencyCode: 'USD',
        centAmount: 7500,
      });
      expect(setCartTotalTax.externalTaxPortions).toEqual([]);
    });
  });
});
