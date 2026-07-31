import { expect, describe, it } from '@jest/globals';
import { buildTaxJarOrderPayload } from '../../src/services/taxjar-order-sync.service.js';

const config = { taxjarFromCountry: 'US', taxjarFromState: 'NC' };

function buildOrder(overrides = {}) {
  return {
    id: 'order-1',
    orderNumber: 'ORD-1001',
    createdAt: '2026-07-31T13:00:00.000Z',
    shippingAddress: {
      country: 'US',
      state: 'NC',
      postalCode: '27701',
      city: 'Durham',
    },
    shippingInfo: {
      price: { currencyCode: 'USD', centAmount: 500, fractionDigits: 2 },
    },
    taxedPrice: {
      totalNet: { currencyCode: 'USD', centAmount: 7500, fractionDigits: 2 },
      totalGross: { currencyCode: 'USD', centAmount: 8063, fractionDigits: 2 },
      totalTax: { currencyCode: 'USD', centAmount: 563, fractionDigits: 2 },
    },
    lineItems: [
      {
        id: 'line1',
        productId: 'product-1',
        quantity: 2,
        name: { 'en-US': 'Widget' },
        variant: { sku: 'WID-01' },
        price: {
          value: { currencyCode: 'USD', centAmount: 1500, fractionDigits: 2 },
        },
        totalPrice: {
          currencyCode: 'USD',
          centAmount: 3000,
          fractionDigits: 2,
        },
        taxedPrice: {
          totalNet: {
            currencyCode: 'USD',
            centAmount: 3000,
            fractionDigits: 2,
          },
          totalGross: {
            currencyCode: 'USD',
            centAmount: 3225,
            fractionDigits: 2,
          },
          totalTax: { currencyCode: 'USD', centAmount: 225, fractionDigits: 2 },
        },
      },
    ],
    ...overrides,
  };
}

describe('taxjar-order-sync.service', () => {
  it('builds a valid TaxJar createOrder payload from a taxed Order', () => {
    const payload = buildTaxJarOrderPayload(buildOrder(), config);

    expect(payload).toEqual({
      transaction_id: 'ORD-1001',
      transaction_date: '2026-07-31',
      from_country: 'US',
      from_state: 'NC',
      to_country: 'US',
      to_state: 'NC',
      to_zip: '27701',
      to_city: 'Durham',
      amount: 35,
      shipping: 5,
      sales_tax: 5.63,
      line_items: [
        {
          id: 'line1',
          quantity: 2,
          product_identifier: 'WID-01',
          description: 'Widget',
          unit_price: 15,
          discount: 0,
          sales_tax: 2.25,
        },
      ],
    });
  });

  it('falls back to the Order id when orderNumber is absent', () => {
    const payload = buildTaxJarOrderPayload(
      buildOrder({ orderNumber: undefined }),
      config
    );
    expect(payload.transaction_id).toBe('order-1');
  });

  it('returns null when the Order has no taxedPrice yet', () => {
    const payload = buildTaxJarOrderPayload(
      buildOrder({ taxedPrice: undefined }),
      config
    );
    expect(payload).toBeNull();
  });

  it('returns null when the Order has no shippingAddress', () => {
    const payload = buildTaxJarOrderPayload(
      buildOrder({ shippingAddress: undefined }),
      config
    );
    expect(payload).toBeNull();
  });
});
