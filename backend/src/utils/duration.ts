const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/** Parses simple durations like "15m", "7d", "30s" into milliseconds. */
export function parseDurationMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) throw new Error(`Invalid duration format: "${value}"`);
  const amount = Number(match[1]);
  const unitMs = UNIT_MS[match[2] as string];
  if (unitMs === undefined) throw new Error(`Invalid duration format: "${value}"`);
  return amount * unitMs;
}
