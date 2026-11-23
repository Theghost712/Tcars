import { describe, expect, it } from 'vitest';
import { daysLeft, formatKm, formatTzs, label, timeAgo } from './format';

describe('formatting', () => {
  it('formats shillings with thousands separators', () => {
    expect(formatTzs(85000000)).toMatch(/^TZS 85,000,000$/);
  });

  it('formats kilometres', () => {
    expect(formatKm(98000)).toMatch(/^98,000 km$/);
  });

  it('translates known codes and keeps unknown ones', () => {
    expect(label('automatic')).toBe('Automatic');
    expect(label('mystery')).toBe('mystery');
  });

  it('describes relative times', () => {
    const now = new Date('2026-06-01T12:00:00Z');
    expect(timeAgo('2026-06-01T11:59:30Z', now)).toBe('just now');
    expect(timeAgo('2026-06-01T10:00:00Z', now)).toBe('2 h ago');
    expect(timeAgo('2026-05-30T12:00:00Z', now)).toBe('2 days ago');
  });

  it('counts days until expiry and never goes negative', () => {
    const now = new Date('2026-06-01T00:00:00Z');
    expect(daysLeft('2026-06-11T00:00:00Z', now)).toBe(10);
    expect(daysLeft('2026-05-01T00:00:00Z', now)).toBe(0);
    expect(daysLeft(null, now)).toBeNull();
  });
});
