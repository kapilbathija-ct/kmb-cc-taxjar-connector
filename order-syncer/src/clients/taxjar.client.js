import Taxjar from 'taxjar';
import readConfiguration from '../utils/config.util.js';

let client;

/**
 * Lazily build a singleton TaxJar SDK client, pointed at the sandbox or live
 * TaxJar API depending on TAX_PROVIDER_ENV (defaults to sandbox so a
 * misconfigured deployment fails safe rather than posting real transactions).
 */
export const getTaxJarClient = () => {
  if (client) {
    return client;
  }

  const config = readConfiguration();
  client = new Taxjar({
    apiKey: config.taxProviderApiToken,
    apiUrl:
      config.taxProviderEnv === 'live'
        ? Taxjar.DEFAULT_API_URL
        : Taxjar.SANDBOX_API_URL,
  });

  return client;
};
