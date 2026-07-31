import { expect, describe, afterAll, it } from '@jest/globals';
import request from 'supertest';
import server from '../../src/index.js';
import configUtils from '../../src/utils/config.util.js';
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_UNAUTHORIZED,
  HTTP_STATUS_SUCCESS_ACCEPTED,
} from '../../src/constants/http.status.constants.js';

/** Reminder : Please put mandatory environment variables in the settings of your github repository **/
describe('Test tax-calculator.controller.js', () => {
  const authHeader = `Bearer ${
    configUtils.readConfiguration().extensionAuthToken
  }`;

  it(`When resource identifier is absent in URL, it should return 404 http status`, async () => {
    const response = await request(server).post(`/`);
    expect(response).toBeDefined();
    expect(response.statusCode).toEqual(404);
  });

  it(`When the Authorization header is missing or wrong, it should return 401 http status`, async () => {
    const response = await request(server).post(`/taxCalculator`).send({});
    expect(response.statusCode).toEqual(HTTP_STATUS_UNAUTHORIZED);
  });

  it(`When payload body does not exist, it should return 400 http status`, async () => {
    const response = await request(server)
      .post(`/taxCalculator`)
      .set('Authorization', authHeader)
      .send({});

    expect(response).toBeDefined();
    expect(response.statusCode).toEqual(HTTP_STATUS_BAD_REQUEST);
  });

  it(`When payload body exists without correct cart information, it should return 400 http status`, async () => {
    const response = await request(server)
      .post(`/taxCalculator`)
      .set('Authorization', authHeader)
      .send({ resource: {} });

    expect(response).toBeDefined();
    expect(response.statusCode).toEqual(HTTP_STATUS_BAD_REQUEST);
  });

  it(`When the Cart has no taxable line items, it should return 202 with update actions`, async () => {
    const response = await request(server)
      .post(`/taxCalculator`)
      .set('Authorization', authHeader)
      .send({
        resource: {
          obj: {
            totalPrice: { currencyCode: 'USD', centAmount: 0, fractionDigits: 2 },
            shippingAddress: { country: 'US', state: 'NC', postalCode: '27701' },
            lineItems: [],
            customLineItems: [],
          },
        },
      });

    expect(response.statusCode).toEqual(HTTP_STATUS_SUCCESS_ACCEPTED);
    expect(response.body.actions).toBeDefined();
  });

  afterAll(() => {
    // Enable the function below to close the application on server once all test cases are executed.

    if (server) {
      server.close();
    }
  });
});
