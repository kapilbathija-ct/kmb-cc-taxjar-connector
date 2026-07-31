import { expect, describe, it } from '@jest/globals';
import { centsToDecimal, decimalToCents } from '../../src/utils/money.util.js';

describe('money.util', () => {
  describe('centsToDecimal', () => {
    it('converts centAmount to a decimal using fractionDigits', () => {
      expect(centsToDecimal(2688, 2)).toBeCloseTo(26.88);
      expect(centsToDecimal(500, 2)).toBeCloseTo(5.0);
    });

    it('defaults fractionDigits to 2', () => {
      expect(centsToDecimal(1050)).toBeCloseTo(10.5);
    });
  });

  describe('decimalToCents', () => {
    it('converts a decimal amount to centAmount, rounding to the nearest cent', () => {
      expect(decimalToCents(26.88, 2)).toBe(2688);
      expect(decimalToCents(5.625, 2)).toBe(563);
    });

    it('defaults fractionDigits to 2', () => {
      expect(decimalToCents(10.5)).toBe(1050);
    });
  });
});
