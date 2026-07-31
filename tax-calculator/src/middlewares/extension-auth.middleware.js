import configUtils from '../utils/config.util.js';
import CustomError from '../errors/custom.error.js';
import { HTTP_STATUS_UNAUTHORIZED } from '../constants/http.status.constants.js';

/**
 * Validates the commercetools API Extension's AuthorizationHeaderAuthentication
 * secret on every inbound request, so this endpoint can't be driven by anyone
 * other than the commercetools project it's registered against.
 */
export const verifyExtensionAuth = (request, response, next) => {
  const { extensionAuthToken } = configUtils.readConfiguration();
  const authHeader = request.headers['authorization'];

  if (authHeader !== `Bearer ${extensionAuthToken}`) {
    return response
      .status(HTTP_STATUS_UNAUTHORIZED)
      .send(
        new CustomError(
          HTTP_STATUS_UNAUTHORIZED,
          'Unauthorized: missing or invalid Authorization header.'
        )
      );
  }

  return next();
};
