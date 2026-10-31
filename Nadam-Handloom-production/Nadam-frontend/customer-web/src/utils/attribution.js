// Where a visitor first came from (utm values or the referring site), kept in this browser
// for 30 days and sent once with sign-up for the shop's analytics. No tracking scripts.
const KEY = 'nh-first-visit';
const DAYS = 30;

export function captureFirstVisit(loc = window.location, referrer = document.referrer) {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && Date.now() - saved.at < DAYS * 86400000) return;
    const q = new URLSearchParams(loc.search);
    let ref = '';
    try {
      const r = referrer ? new URL(referrer) : null;
      if (r && r.host !== loc.host) ref = r.host.replace(/^www\./, '');
    } catch { /* not a URL */ }
    const v = {
      source: q.get('utm_source') || ref || 'direct',
      medium: q.get('utm_medium') || (ref ? 'referral' : 'none'),
      campaign: q.get('utm_campaign') || '',
      referrer: ref,
      at: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch { /* storage blocked: nothing to remember */ }
}

export function firstVisit() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!v) return undefined;
    const out = {};
    for (const k of ['source', 'medium', 'campaign', 'referrer']) if (v[k]) out[k] = String(v[k]).slice(0, k === 'referrer' ? 200 : 100);
    return out;
  } catch {
    return undefined;
  }
}
