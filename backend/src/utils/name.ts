export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0] ?? fullName.trim();
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : firstName;
  return { firstName, lastName };
}
