/** Matches Postgres's text output for a tstzrange, quoted or not: ["a","b") */
const TSTZRANGE_PATTERN = /^[[(]"?([^",]+)"?,"?([^",]+)"?[\])]$/;

/** Postgres prints "2026-09-14 18:00:00+00"; ISO 8601 wants a "T" and a "+00:00" offset. */
function parseTimestamptz(value: string): Date {
  return new Date(value.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00'));
}

/**
 * BookingApi always writes both bounds, so an empty or unbounded range means the row
 * wasn't written by either app — worth failing loudly rather than inventing dates.
 */
export function parseTstzRange(range: string): { from: Date; to: Date } {
  const match = TSTZRANGE_PATTERN.exec(range);

  if (!match) {
    throw new Error(`Unrecognised tstzrange literal: ${range}`);
  }

  return { from: parseTimestamptz(match[1]), to: parseTimestamptz(match[2]) };
}

/** Half-open [from, to), matching how BookingApi writes Duration. */
export function formatTstzRange(from: Date, to: Date): string {
  return `[${from.toISOString()},${to.toISOString()})`;
}
