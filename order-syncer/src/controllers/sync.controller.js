import { logger } from '../utils/logger.util.js';
import { doValidation } from '../validators/order-change.validators.js';
import { decodeToJson } from '../utils/decoder.util.js';
import { getOrderById } from '../clients/query.client.js';
import readConfiguration from '../utils/config.util.js';
import { getTaxJarClient } from '../clients/taxjar.client.js';
import { buildTaxJarOrderPayload } from '../services/taxjar-order-sync.service.js';
import {
  HTTP_STATUS_SUCCESS_NO_CONTENT,
  HTTP_STATUS_SERVER_ERROR,
  HTTP_STATUS_SUCCESS_ACCEPTED,
} from '../constants/http.status.constants.js';
import CustomError from '../errors/custom.error.js';

async function syncToTaxProvider(order) {
  const config = readConfiguration();
  const payload = buildTaxJarOrderPayload(order, config);

  if (!payload) {
    logger.info(
      `Order ${order.id} has no taxedPrice yet - skipping TaxJar sync.`
    );
    return;
  }

  await getTaxJarClient().createOrder(payload);
}

export const syncHandler = async (request, response) => {
  try {
    // Receive the Pub/Sub message
    const encodedMessageBody = request.body?.message?.data;
    if (!encodedMessageBody) {
      throw new CustomError(
        HTTP_STATUS_SUCCESS_ACCEPTED,
        'Missing message data from incoming event message.'
      );
    }

    const messageBody = decodeToJson(encodedMessageBody);
    doValidation(messageBody);

    const orderId = messageBody?.resource?.id;
    const order = await getOrderById(orderId);
    if (order) {
      await syncToTaxProvider(order);
    }
  } catch (err) {
    logger.error(err);
    if (err.statusCode) return response.status(err.statusCode).send(err);

    // The TaxJar SDK rejects with { status, error, detail } rather than an
    // Error carrying statusCode.
    if (err.status) {
      const taxJarError = new CustomError(
        HTTP_STATUS_SERVER_ERROR,
        `TaxJar error: ${err.detail || err.error || err.message}`
      );
      return response.status(HTTP_STATUS_SERVER_ERROR).send(taxJarError);
    }

    return response.status(HTTP_STATUS_SERVER_ERROR).send(err);
  }

  // Return the response for the client
  return response.status(HTTP_STATUS_SUCCESS_NO_CONTENT).send();
};
