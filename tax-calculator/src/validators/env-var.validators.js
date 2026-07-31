import {
  optional,
  standardString,
  standardKey,
  region,
  usState,
} from './helpers.validators.js';

/**
 * Create here your own validators
 */
const envValidators = [
  standardString(
    ['clientId'],
    {
      code: 'InValidClientId',
      message: 'Client id should be 24 characters.',
      referencedBy: 'environmentVariables',
    },
    { min: 24, max: 24 }
  ),

  standardString(
    ['clientSecret'],
    {
      code: 'InvalidClientSecret',
      message: 'Client secret should be 32 characters.',
      referencedBy: 'environmentVariables',
    },
    { min: 32, max: 32 }
  ),

  standardKey(['projectKey'], {
    code: 'InvalidProjectKey',
    message: 'Project key should be a valid string.',
    referencedBy: 'environmentVariables',
  }),

  optional(standardString)(
    ['scope'],
    {
      code: 'InvalidScope',
      message: 'Scope should be at least 2 characters long.',
      referencedBy: 'environmentVariables',
    },
    { min: 2, max: undefined }
  ),

  region(['region'], {
    code: 'InvalidRegion',
    message: 'Not a valid region.',
    referencedBy: 'environmentVariables',
  }),

  standardString(
    ['taxProviderApiToken'],
    {
      code: 'InvalidTaxProviderApiToken',
      message: 'TAX_PROVIDER_API_TOKEN should be a valid TaxJar API token.',
      referencedBy: 'environmentVariables',
    },
    { min: 20, max: 64 }
  ),

  standardString(
    ['taxjarFromCountry'],
    {
      code: 'InvalidTaxjarFromCountry',
      message: 'TAXJAR_FROM_COUNTRY should be a 2-letter ISO country code.',
      referencedBy: 'environmentVariables',
    },
    { min: 2, max: 2 }
  ),

  usState(['taxjarFromState'], {
    code: 'InvalidTaxjarFromState',
    message:
      'TAXJAR_FROM_STATE should be a 2-letter US state/province code matching your TaxJar nexus settings.',
    referencedBy: 'environmentVariables',
  }),

  optional(standardString)(
    ['taxjarFromZip'],
    {
      code: 'InvalidTaxjarFromZip',
      message: 'TAXJAR_FROM_ZIP should be a valid postal code.',
      referencedBy: 'environmentVariables',
    },
    { min: 3, max: 12 }
  ),

  standardString(
    ['extensionAuthToken'],
    {
      code: 'InvalidExtensionAuthToken',
      message:
        'EXTENSION_AUTH_TOKEN should be a strong shared secret (min 16 characters) used to authenticate the commercetools API Extension request.',
      referencedBy: 'environmentVariables',
    },
    { min: 16, max: 128 }
  ),
];

export default envValidators;
