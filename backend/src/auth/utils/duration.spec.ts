import { parseDurationMs, addDuration } from './duration';

describe('duration', () => {
  describe('parseDurationMs', () => {
    it.each([
      ['30s', 30_000],
      ['15m', 900_000],
      ['2h', 7_200_000],
      ['7d', 604_800_000],
    ])('parses %s', (input, expected) => {
      expect(parseDurationMs(input)).toBe(expected);
    });

    it('treats a bare number as seconds, matching jsonwebtoken', () => {
      expect(parseDurationMs('3600')).toBe(3_600_000);
    });

    it('accepts an uppercase unit', () => {
      expect(parseDurationMs('7D')).toBe(604_800_000);
    });

    it('tolerates surrounding whitespace', () => {
      expect(parseDurationMs('  15m  ')).toBe(900_000);
    });

    it('throws on an unrecognised unit rather than guessing', () => {
      // Silently defaulting here would produce a session that expires at
      // the wrong time, which is far harder to notice than a startup error.
      expect(() => parseDurationMs('7w')).toThrow(/Unrecognized duration/);
    });

    it('throws on nonsense input', () => {
      expect(() => parseDurationMs('soon')).toThrow();
      expect(() => parseDurationMs('')).toThrow();
    });
  });

  describe('addDuration', () => {
    it('returns a date the given distance into the future', () => {
      const start = new Date('2026-01-01T00:00:00.000Z');

      expect(addDuration(start, '7d').toISOString()).toBe(
        '2026-01-08T00:00:00.000Z',
      );
    });

    it('does not mutate the date it was given', () => {
      const start = new Date('2026-01-01T00:00:00.000Z');
      addDuration(start, '7d');

      expect(start.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    });
  });
});
