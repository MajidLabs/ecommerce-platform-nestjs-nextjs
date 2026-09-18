// Parses the same duration strings used for JWT_ACCESS_EXPIRATION /
// JWT_REFRESH_EXPIRATION (e.g. '15m', '7d', '3600') into milliseconds, so
// a Session row's `expiresAt` can be computed without pulling in a
// separate dependency just for this one conversion.
const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export function parseDurationMs(value: string): number {
  const match = /^(\d+)\s*(s|m|h|d)?$/i.exec(value.trim());
  if (!match) {
    throw new Error(`Unrecognized duration string: "${value}"`);
  }
  const amount = Number(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  return amount * UNIT_MS[unit];
}

export function addDuration(from: Date, durationString: string): Date {
  return new Date(from.getTime() + parseDurationMs(durationString));
}
