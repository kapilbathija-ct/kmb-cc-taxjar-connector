import { createApiRoot } from './create.client.js';
import CustomError from '../errors/custom.error.js';
import { HTTP_STATUS_SUCCESS_ACCEPTED } from '../constants/http.status.constants.js';

/**
 * Fetches the Order directly by ID. The Order is the authoritative,
 * immutable snapshot of everything taxjar-order-sync needs (taxedPrice,
 * lineItems, shippingInfo) - it already carries over the tax-calculator's
 * ExternalAmount tax data set on the Cart, so there's no need to also look
 * up the originating Cart.
 */
export async function getOrderById(orderId) {
  return await createApiRoot()
    .orders()
    .withId({ ID: orderId })
    .get({ queryArgs: { withTotal: false } })
    .execute()
    .then((response) => response.body)
    .catch((error) => {
      throw new CustomError(HTTP_STATUS_SUCCESS_ACCEPTED, error.message, error);
    });
}
