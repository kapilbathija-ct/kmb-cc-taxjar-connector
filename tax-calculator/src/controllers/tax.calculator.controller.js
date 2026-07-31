import _ from 'lodash';
import { logger } from '../utils/logger.utils.js';
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_SERVER_ERROR,
  HTTP_STATUS_SUCCESS_ACCEPTED,
} from '../constants/http.status.constants.js';
import CustomError from '../errors/custom.error.js';
import configUtils from '../utils/config.util.js';
import { getTaxJarClient } from '../clients/taxjar.client.js';
import {
  buildTaxJarRequest,
  buildCartUpdateActions,
} from '../services/tax-calculation.service.js';

export const taxHandler = async (request, response) => {
  const requestBody = request.body;
  const cart = requestBody?.resource?.obj;

  if (_.isEmpty(requestBody) || _.isEmpty(cart)) {
    return response
      .status(HTTP_STATUS_BAD_REQUEST)
      .send(
        new CustomError(
          HTTP_STATUS_BAD_REQUEST,
          'Missing cart information in the request body.'
        )
      );
  }

  try {
    const config = configUtils.readConfiguration();
    const taxableItemCount =
      (cart.lineItems?.length || 0) + (cart.customLineItems?.length || 0);

    // A Cart with nothing to tax (shouldn't normally reach Frozen state, but
    // fail safe rather than sending an empty line_items array to TaxJar).
    const taxJarResult =
      taxableItemCount === 0
        ? { tax: { has_nexus: false } }
        : await getTaxJarClient().taxForOrder(
            buildTaxJarRequest(cart, config)
          );

    const actions = buildCartUpdateActions(cart, taxJarResult);
    return response.status(HTTP_STATUS_SUCCESS_ACCEPTED).send({ actions });
  } catch (err) {
    logger.error(err);

    if (err.statusCode) {
      return response.status(err.statusCode).send(err);
    }

    // The TaxJar SDK rejects with { status, error, detail } rather than an
    // Error carrying statusCode - surface its message without leaking the
    // raw SDK error shape to the caller.
    if (err.status) {
      const taxJarError = new CustomError(
        HTTP_STATUS_SERVER_ERROR,
        `TaxJar error: ${err.detail || err.error || err.message}`
      );
      return response.status(HTTP_STATUS_SERVER_ERROR).send(taxJarError);
    }

    return response.status(HTTP_STATUS_SERVER_ERROR).send(err);
  }
};
