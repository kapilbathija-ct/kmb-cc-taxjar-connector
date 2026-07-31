import { expect, describe, it } from '@jest/globals';
import { centsToDecimal } from '../../src/utils/money.util.js';

describe('money.util', () => {
  it('converts centAmount to a decimal using fractionDigits', () => {
    expect(centsToDecimal(2688, 2)).toBeCloseTo(26.88);
  });

  it('defaults fractionDigits to 2', () => {
    expect(centsToDecimal(1050)).toBeCloseTo(10.5);
  });
});
