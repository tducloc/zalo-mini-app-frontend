import { formatShortRelativeTime, formatVnd } from '@/utils/format';

const now = Date.parse('2026-09-23T10:00:00.000Z');
const ago = (ms: number) => new Date(now - ms).toISOString();

describe('formatShortRelativeTime', () => {
  it('describes recent listings in minutes, hours and days, without "trước"', () => {
    expect(formatShortRelativeTime(ago(20_000), now)).toBe('Vừa xong');
    expect(formatShortRelativeTime(ago(5 * 60_000), now)).toBe('5 phút');
    expect(formatShortRelativeTime(ago(3 * 3_600_000), now)).toBe('3 giờ');
    expect(formatShortRelativeTime(ago(2 * 86_400_000), now)).toBe('2 ngày');
  });

  it('falls back to a day and month without the year after a week', () => {
    const iso = ago(8 * 86_400_000);
    expect(formatShortRelativeTime(iso, now)).toBe(
      new Date(iso).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' }),
    );
  });

  it('treats a publication time slightly in the future as just now', () => {
    expect(formatShortRelativeTime(new Date(now + 5_000).toISOString(), now)).toBe('Vừa xong');
  });
});

describe('formatVnd', () => {
  it('groups thousands as vi-VN does', () => {
    for (const price of [0, 999, 1_000, 25_000_000, 1_234_567_890]) {
      expect(formatVnd(price)).toBe(`${price.toLocaleString('vi-VN')} đ`);
    }
    expect(formatVnd(1_000_000)).toBe('1.000.000 đ');
  });
});
