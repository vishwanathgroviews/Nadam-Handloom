// Text that arrives from phones and browsers can carry characters people never typed on
// purpose: control characters (a pasted link with %00 in it) and invisible marks (a
// byte-order mark, zero-width spaces). The database refuses NUL outright, so they are
// removed before anything is checked or saved. Tabs and new lines stay (descriptions use
// them); the joiners Telugu and Hindi need (U+200C, U+200D) stay too.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const INVISIBLE = /[​⁠﻿]/g;

export const cleanText = (s) => s.replace(CONTROL, ' ').replace(INVISIBLE, '');

// Every string inside a request body, query or params, cleaned (objects and arrays a few
// levels deep; anything deeper is left for the schema to refuse).
export function cleanDeep(value, depth = 0) {
  if (typeof value === 'string') return cleanText(value);
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => cleanDeep(v, depth + 1));
  if (Buffer.isBuffer(value)) return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = cleanDeep(v, depth + 1);
  return out;
}
