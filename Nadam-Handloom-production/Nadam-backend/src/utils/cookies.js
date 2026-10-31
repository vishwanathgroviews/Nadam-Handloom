// Reads cookies from a request (the website's 30-day sign-in cookie).
export function readCookies(req) {
  const out = {};
  for (const raw of String(req.headers.cookie || '').split(';')) {
    const part = raw.trim();
    const i = part.indexOf('=');
    if (i < 1) continue;
    const name = part.slice(0, i).trim();
    let value = part.slice(i + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
}
