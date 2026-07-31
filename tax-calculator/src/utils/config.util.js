import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'node:fs/promises';
import CustomError from '../errors/custom.error.js';
import envValidators from '../validators/env-var.validators.js';
import { getValidateMessages } from '../validators/helpers.validators.js';
import { HTTP_STATUS_SERVER_ERROR } from '../constants/http.status.constants.js';

/**
 * Read the configuration env vars
 * (Add yours accordingly)
 *
 * @returns The configuration with the correct env vars
 */

function readConfiguration() {
  const envVars = {
    clientId: process.env.CTP_CLIENT_ID,
    clientSecret: process.env.CTP_CLIENT_SECRET,
    projectKey: process.env.CTP_PROJECT_KEY,
    scope: process.env.CTP_SCOPE,
    region: process.env.CTP_REGION,
    taxProviderApiToken: process.env.TAX_PROVIDER_API_TOKEN,
    taxProviderEnv: process.env.TAX_PROVIDER_ENV || 'sandbox',
    taxjarFromCountry: process.env.TAXJAR_FROM_COUNTRY || 'US',
    taxjarFromState: process.env.TAXJAR_FROM_STATE,
    taxjarFromZip: process.env.TAXJAR_FROM_ZIP,
    extensionAuthToken: process.env.EXTENSION_AUTH_TOKEN,
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

async function readAndParseJsonFile(pathToJsonFileFromProjectRoot) {
  const currentFilePath = fileURLToPath(__filename);
  const currentDirPath = path.dirname(currentFilePath);
  const projectRoot = path.resolve(currentDirPath, '..');
  const pathToFile = path.resolve(projectRoot, pathToJsonFileFromProjectRoot);
  const fileContent = await fs.readFile(pathToFile);
  return JSON.parse(fileContent);
}

export default {
  readConfiguration,
  readAndParseJsonFile,
};
