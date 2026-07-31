/**
 * Convert a commercetools centAmount into a decimal amount, respecting the
 * Money's fractionDigits (almost always 2, but not guaranteed for every
 * currency).
 */
export const centsToDecimal = (centAmount, fractionDigits = 2) =>
  centAmount / 10 ** fractionDigits;

/**
 * Convert a decimal amount (as returned by TaxJar) into a commercetools
 * centAmount, rounding to the nearest cent.
 */
export const decimalToCents = (decimalAmount, fractionDigits = 2) =>
  Math.round(decimalAmount * 10 ** fractionDigits);
