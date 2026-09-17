/**
 * Reads a "Display order" text field into something safe to send.
 *
 * Returns undefined for blank or non-numeric input, meaning "leave the
 * current position alone". Number('') is 0 and Number('abc') is NaN, and
 * either one sent as a sortOrder silently reorders the storefront (or fails
 * validation) when the person had simply not filled the box in.
 */
export const parseSortOrder = (raw: string): number | undefined => {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const value = Number(trimmed);
  return Number.isInteger(value) && value >= 0 ? value : undefined;
};
