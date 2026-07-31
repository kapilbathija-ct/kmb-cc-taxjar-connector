import { expect, describe, it, jest, beforeEach } from '@jest/globals';
import configUtils from '../../src/utils/config.util.js';
import { getTaxJarClient } from '../../src/clients/taxjar.client.js';
import { taxHandler } from '../../src/controllers/tax.calculator.controller.js';
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_SUCCESS_ACCEPTED,
  HTTP_STATUS_SERVER_ERROR,
} from '../../src/constants/http.status.constants.js';

jest.mock('../../src/utils/config.util.js', () => ({
  __esModule: true,
  default: { readConfiguration: jest.fn() },
}));
jest.mock('../../src/clients/taxjar.client.js', () => ({
  __esModule: true,
  getTaxJarClient: jest.fn(),
}));

const dummyConfig = {
  taxjarFromCountry: 'US',
  taxjarFromState: 'NC',
};

function mockResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

const validCart = {
  totalPrice: { currencyCode: 'USD', centAmount: 3000, fractionDigits: 2 },
  shippingAddress: {
    country: 'US',
    state: 'NC',
    postalCode: '27701',
    city: 'Durham',
  },
  lineItems: [
    {
      id: 'line1',
      quantity: 1,
      price: {
        value: { currencyCode: 'USD', centAmount: 3000, fractionDigits: 2 },
      },
      totalPrice: { currencyCode: 'USD', centAmount: 3000, fractionDigits: 2 },
      variant: { attributes: [] },
    },
  ],
  customLineItems: [],
};

describe('tax-calculator.controller', () => {
  let taxForOrderMock;

  beforeEach(() => {
    configUtils.readConfiguration.mockReturnValue(dummyConfig);
    taxForOrderMock = jest.fn();
    getTaxJarClient.mockReturnValue({ taxForOrder: taxForOrderMock });
  });

  it('returns 400 when the request body is empty', async () => {
    const res = mockResponse();
    await taxHandler({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS_BAD_REQUEST);
  });

  it('returns 400 when resource.obj (the Cart) is missing', async () => {
    const res = mockResponse();
    await taxHandler({ body: { resource: {} } }, res);
    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS_BAD_REQUEST);
  });

  it('calls TaxJar and returns 202 with update actions for a valid Cart', async () => {
    taxForOrderMock.mockResolvedValue({ tax: { has_nexus: false } });

    const res = mockResponse();
    await taxHandler({ body: { resource: { obj: validCart } } }, res);

    expect(taxForOrderMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS_SUCCESS_ACCEPTED);
    const [{ actions }] = res.send.mock.calls[0];
    expect(actions.some((a) => a.action === 'setLineItemTaxAmount')).toBe(
      true
    );
    expect(actions.some((a) => a.action === 'setCartTotalTax')).toBe(true);
  });

  it('skips the TaxJar call entirely for a Cart with no taxable items', async () => {
    const emptyCart = { ...validCart, lineItems: [], customLineItems: [] };
    const res = mockResponse();

    await taxHandler({ body: { resource: { obj: emptyCart } } }, res);

    expect(taxForOrderMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS_SUCCESS_ACCEPTED);
  });

  it('returns 400 when the Cart is missing a shippingAddress', async () => {
    const cart = { ...validCart, shippingAddress: undefined };
    const res = mockResponse();

    await taxHandler({ body: { resource: { obj: cart } } }, res);

    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS_BAD_REQUEST);
    expect(taxForOrderMock).not.toHaveBeenCalled();
  });

  it('returns 500 with the TaxJar error surfaced when the TaxJar SDK rejects', async () => {
    taxForOrderMock.mockRejectedValue({
      status: 422,
      error: 'Unprocessable Entity',
      detail: 'to_zip is not valid',
    });

    const res = mockResponse();
    await taxHandler({ body: { resource: { obj: validCart } } }, res);

    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS_SERVER_ERROR);
    const [sentError] = res.send.mock.calls[0];
    expect(sentError.message).toMatch(/to_zip is not valid/);
  });
});
