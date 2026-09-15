const UNIT_MS: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/** Parses simple durations like '8h', '30m', '3600s' into milliseconds. */
export function parseDurationMs(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());

  if (!match) {
    throw new Error(`Invalid duration: "${value}"`);
  }

  const [, amount, unit] = match;
  return Number(amount) * UNIT_MS[unit];
}
