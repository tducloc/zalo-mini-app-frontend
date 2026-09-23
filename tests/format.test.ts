import { formatRelativeTime } from '@/utils/format';

const now = Date.parse('2026-09-23T10:00:00.000Z');
const ago = (ms: number) => new Date(now - ms).toISOString();

describe('formatRelativeTime', () => {
  it('describes recent listings in minutes, hours and days', () => {
    expect(formatRelativeTime(ago(20_000), now)).toBe('Vừa xong');
    expect(formatRelativeTime(ago(5 * 60_000), now)).toBe('5 phút trước');
    expect(formatRelativeTime(ago(3 * 3_600_000), now)).toBe('3 giờ trước');
    expect(formatRelativeTime(ago(2 * 86_400_000), now)).toBe('2 ngày trước');
  });

  it('falls back to a calendar date after a week', () => {
    const iso = ago(8 * 86_400_000);
    expect(formatRelativeTime(iso, now)).toBe(new Date(iso).toLocaleDateString('vi-VN'));
  });

  it('treats a publication time slightly in the future as just now', () => {
    expect(formatRelativeTime(new Date(now + 5_000).toISOString(), now)).toBe('Vừa xong');
  });
});
