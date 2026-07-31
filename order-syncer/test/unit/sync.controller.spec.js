import { expect, describe, it, jest, beforeEach } from '@jest/globals';
import { syncHandler } from '../../src/controllers/sync.controller.js';
import { getOrderById } from '../../src/clients/query.client.js';
import readConfiguration from '../../src/utils/config.util.js';
import { getTaxJarClient } from '../../src/clients/taxjar.client.js';
import {
  HTTP_STATUS_SUCCESS_ACCEPTED,
  HTTP_STATUS_SUCCESS_NO_CONTENT,
  HTTP_STATUS_SERVER_ERROR,
} from '../../src/constants/http.status.constants.js';

jest.mock('../../src/clients/query.client.js', () => ({
  getOrderById: jest.fn(),
}));
jest.mock('../../src/utils/config.util.js', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('../../src/clients/taxjar.client.js', () => ({
  getTaxJarClient: jest.fn(),
}));

const dummyConfig = { taxjarFromCountry: 'US', taxjarFromState: 'NC' };

function encodeJsonObject(messageBody) {
  return Buffer.from(JSON.stringify(messageBody)).toString('base64').trim();
}

function mockResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

const taxedOrder = {
  id: 'order-1',
  orderNumber: 'ORD-1001',
  createdAt: '2026-07-31T13:00:00.000Z',
  shippingAddress: { country: 'US', state: 'NC', postalCode: '27701' },
  shippingInfo: {
    price: { currencyCode: 'USD', centAmount: 500, fractionDigits: 2 },
  },
  taxedPrice: {
    totalNet: { currencyCode: 'USD', centAmount: 3000, fractionDigits: 2 },
    totalGross: { currencyCode: 'USD', centAmount: 3225, fractionDigits: 2 },
    totalTax: { currencyCode: 'USD', centAmount: 225, fractionDigits: 2 },
  },
  lineItems: [
    {
      id: 'line1',
      productId: 'product-1',
      quantity: 1,
      name: { 'en-US': 'Widget' },
      variant: { sku: 'WID-01' },
      price: {
        value: { currencyCode: 'USD', centAmount: 3000, fractionDigits: 2 },
      },
      totalPrice: { currencyCode: 'USD', centAmount: 3000, fractionDigits: 2 },
      taxedPrice: {
        totalNet: { currencyCode: 'USD', centAmount: 3000, fractionDigits: 2 },
        totalGross: { currencyCode: 'USD', centAmount: 3225, fractionDigits: 2 },
        totalTax: { currencyCode: 'USD', centAmount: 225, fractionDigits: 2 },
      },
    },
  ],
};

function orderCreatedPayload(resourceId = 'order-1') {
  return {
    message: {
      data: encodeJsonObject({
        notificationType: 'Message',
        type: 'OrderCreated',
        resource: { typeId: 'order', id: resourceId },
      }),
    },
  };
}

describe('sync.controller', () => {
  let createOrderMock;

  beforeEach(() => {
    readConfiguration.mockReturnValue(dummyConfig);
    createOrderMock = jest.fn().mockResolvedValue({ order: {} });
    getTaxJarClient.mockReturnValue({ createOrder: createOrderMock });
    getOrderById.mockReset();
  });

  it('returns 202 (ack, no retry) when message data is missing', async () => {
    const res = mockResponse();
    await syncHandler({ body: { message: {} } }, res);
    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS_SUCCESS_ACCEPTED);
  });

  it('acks non-OrderCreated / malformed messages without calling TaxJar', async () => {
    const res = mockResponse();
    await syncHandler(
      { body: { message: { data: encodeJsonObject({ type: 'ProductCreated' }) } } },
      res
    );
    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS_SUCCESS_ACCEPTED);
    expect(getOrderById).not.toHaveBeenCalled();
  });

  it('fetches the Order and calls TaxJar createOrder for a valid OrderCreated message', async () => {
    getOrderById.mockResolvedValue(taxedOrder);
    const res = mockResponse();

    await syncHandler({ body: orderCreatedPayload() }, res);

    expect(getOrderById).toHaveBeenCalledWith('order-1');
    expect(createOrderMock).toHaveBeenCalledTimes(1);
    expect(createOrderMock.mock.calls[0][0]).toMatchObject({
      transaction_id: 'ORD-1001',
    });
    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS_SUCCESS_NO_CONTENT);
  });

  it('skips the TaxJar call when the Order has no taxedPrice yet', async () => {
    getOrderById.mockResolvedValue({ ...taxedOrder, taxedPrice: undefined });
    const res = mockResponse();

    await syncHandler({ body: orderCreatedPayload() }, res);

    expect(createOrderMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS_SUCCESS_NO_CONTENT);
  });

  it('surfaces a TaxJar SDK error as 500', async () => {
    getOrderById.mockResolvedValue(taxedOrder);
    createOrderMock.mockRejectedValue({
      status: 422,
      detail: 'transaction_id has already been used',
    });
    const res = mockResponse();

    await syncHandler({ body: orderCreatedPayload() }, res);

    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS_SERVER_ERROR);
    const [sentError] = res.send.mock.calls[0];
    expect(sentError.message).toMatch(/transaction_id has already been used/);
  });
});
