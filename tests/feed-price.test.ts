import {
  applyPriceEdit,
  caretAfterDigits,
  formatPriceDigits,
  parsePriceRange,
  priceToInputDigits,
} from '@/features/feed/utils/price';
import { MAX_PRICE_VND } from '@/features/products/constants/product';

const group = (value: number) => new Intl.NumberFormat('vi-VN').format(value);

describe('applyPriceEdit', () => {
  it('keeps only digits from typed or pasted text', () => {
    expect(applyPriceEdit({ value: '1.000.000', caret: 9, previousDigits: '' }).digits).toBe(
      '1000000',
    );
    expect(applyPriceEdit({ value: '2,5tr', caret: 5, previousDigits: '' }).digits).toBe('25');
  });

  it('drops leading zeros and moves the caret with them', () => {
    expect(applyPriceEdit({ value: '000120', caret: 6, previousDigits: '' })).toEqual({
      digits: '120',
      digitsBeforeCaret: 3,
    });
    expect(applyPriceEdit({ value: '0', caret: 1, previousDigits: '' }).digits).toBe('0');
  });

  it('keeps the caret on the same digit when typing in the middle', () => {
    // "1.000" with "5" typed after the first digit → "15.000" displayed as "15.000"
    expect(applyPriceEdit({ value: '15.000', caret: 2, previousDigits: '1000' })).toEqual({
      digits: '15000',
      digitsBeforeCaret: 2,
    });
  });

  it('deletes the digit before a separator when backspace only removed the dot', () => {
    // "1.234.567": backspace right after the second dot leaves "1.234567", caret before "5"
    expect(
      applyPriceEdit({
        value: '1.234567',
        caret: 5,
        previousDigits: '1234567',
        inputType: 'deleteContentBackward',
      }),
    ).toEqual({ digits: '123567', digitsBeforeCaret: 3 });
  });

  it('deletes the digit after a separator on forward delete', () => {
    expect(
      applyPriceEdit({
        value: '1234',
        caret: 1,
        previousDigits: '1234',
        inputType: 'deleteContentForward',
      }),
    ).toEqual({ digits: '134', digitsBeforeCaret: 1 });
  });

  it('keeps an oversized paste so validation rejects it instead of truncating', () => {
    const { digits } = applyPriceEdit({
      value: '1.000.000.000.000',
      caret: 17,
      previousDigits: '',
    });

    expect(digits).toBe('1000000000000');
    expect(parsePriceRange(digits, '').errors.minPrice).toMatch(/Giá tối đa/);
  });
});

describe('caretAfterDigits', () => {
  it('finds the position after the n-th digit, skipping separators', () => {
    const formatted = group(1_234_567);

    expect(caretAfterDigits(formatted, 0)).toBe(0);
    expect(caretAfterDigits(formatted, 1)).toBe(1);
    expect(caretAfterDigits(formatted, 2)).toBe(3);
    expect(caretAfterDigits(formatted, 7)).toBe(formatted.length);
  });
});

describe('formatPriceDigits and priceToInputDigits', () => {
  it('groups digits for display and leaves empty input empty', () => {
    expect(formatPriceDigits('1000000')).toBe(group(1_000_000));
    expect(formatPriceDigits('')).toBe('');
  });

  it('turns an applied price back into input digits', () => {
    expect(priceToInputDigits(0)).toBe('0');
    expect(priceToInputDigits(undefined)).toBe('');
  });
});

describe('parsePriceRange', () => {
  it('treats empty inputs as no bound', () => {
    expect(parsePriceRange('', '')).toEqual({
      minPrice: undefined,
      maxPrice: undefined,
      errors: {},
    });
  });

  it('accepts a zero minimum and an equal range', () => {
    expect(parsePriceRange('0', '0')).toEqual({ minPrice: 0, maxPrice: 0, errors: {} });
  });

  it('rejects a minimum above the maximum on the maximum field', () => {
    expect(parsePriceRange('500', '100').errors).toEqual({
      maxPrice: 'Giá đến phải lớn hơn hoặc bằng giá từ.',
    });
  });

  it('rejects amounts above the backend integer range', () => {
    const tooLarge = String(MAX_PRICE_VND + 1);
    const result = parsePriceRange(tooLarge, tooLarge);

    expect(result.errors.minPrice).toMatch(/Giá tối đa/);
    expect(result.errors.maxPrice).toMatch(/Giá tối đa/);
  });

  it('accepts the maximum amount itself', () => {
    expect(parsePriceRange('', String(MAX_PRICE_VND)).errors).toEqual({});
  });
});
