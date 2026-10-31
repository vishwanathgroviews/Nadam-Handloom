import { AUTH } from '../config/constants.js';

// Returns the rules a new PIN breaks (empty list = allowed).
// Rule codes: length, all_same, sequence, mobile_tail.
export function pinProblems(pin, mobile) {
  const p = String(pin ?? '');
  if (!/^\d+$/.test(p) || p.length !== AUTH.PIN_LENGTH) return ['length'];
  const problems = [];
  if (/^(\d)\1+$/.test(p)) problems.push('all_same');
  if ('0123456789'.includes(p) || '9876543210'.includes(p)) problems.push('sequence');
  if (mobile && String(mobile).slice(-AUTH.PIN_LENGTH) === p) problems.push('mobile_tail');
  return problems;
}

export const PIN_PROBLEM_TEXT = Object.freeze({
  length: 'The PIN must be exactly 6 digits.',
  all_same: 'The PIN can\'t be the same digit repeated (like 111111).',
  sequence: 'The PIN can\'t be a straight run (like 123456 or 654321).',
  mobile_tail: 'The PIN can\'t be the last 6 digits of your mobile number.',
  same_as_current: 'Choose a PIN different from your current one.',
});

export const lockMinutes = (lockCount) =>
  AUTH.LOCK_MINUTES[Math.min(Math.max(lockCount, 1), AUTH.LOCK_MINUTES.length) - 1];
