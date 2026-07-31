import CustomError from '../errors/custom.error.js';
import envValidators from '../validators/env-var.validator.js';
import { getValidateMessages } from '../validators/helpers.validator.js';
import { HTTP_STATUS_SERVER_ERROR } from '../constants/http.status.constants.js';

/**
 * Read the configuration env vars
 * (Add yours accordingly)
 *
 * @returns The configuration with the correct env vars
 */
export default function readConfiguration() {
  const envVars = {
    clientId: process.env.CTP_CLIENT_ID,
    clientSecret: process.env.CTP_CLIENT_SECRET,
    projectKey: process.env.CTP_PROJECT_KEY,
    scope: process.env.CTP_SCOPE,
    region: process.env.CTP_REGION,
    connectSubscriptionDestination:
      process.env.CONNECT_SUBSCRIPTION_DESTINATION,
    connectGcpTopicName: process.env.CONNECT_GCP_TOPIC_NAME,
    connectGcpProjectId: process.env.CONNECT_GCP_PROJECT_ID,
    connectAwsTopicArn: process.env.CONNECT_AWS_TOPIC_ARN,
    taxProviderApiToken: process.env.TAX_PROVIDER_API_TOKEN,
    taxProviderEnv: process.env.TAX_PROVIDER_ENV || 'sandbox',
    taxjarFromCountry: process.env.TAXJAR_FROM_COUNTRY || 'US',
    taxjarFromState: process.env.TAXJAR_FROM_STATE,
    taxjarFromZip: process.env.TAXJAR_FROM_ZIP,
  };

  const validationErrors = getValidateMessages(envValidators, envVars);

  if (validationErrors.length) {
    throw new CustomError(
      HTTP_STATUS_SERVER_ERROR,
      'Invalid Environment Variables please check your .env file',
      validationErrors
    );
  }

  return envVars;
}
