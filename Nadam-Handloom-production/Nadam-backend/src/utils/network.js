// Which "network" a request came from, for the SMS code limits.
// - IPv4: one address. Mobile carriers in India put many customers behind one IPv4
//   address (carrier NAT), so its limit is higher.
// - IPv6: each home or phone gets a whole /64 block and can use any address in it, so the
//   limit counts the block (the first four groups), not the single address.
export function networkOf(ip) {
  if (!ip) return null;
  let a = String(ip).trim().toLowerCase().replace(/%.*$/, ''); // drop a zone id (fe80::1%eth0)
  if (a.startsWith('::ffff:') && a.includes('.')) a = a.slice(7); // IPv4 written as IPv6
  if (!a.includes(':')) return /^\d{1,3}(\.\d{1,3}){3}$/.test(a) ? { key: a, v6: false } : null;
  let groups;
  if (a.includes('::')) {
    const [head, tail] = a.split('::');
    const h = head ? head.split(':') : [];
    const t = tail ? tail.split(':') : [];
    groups = [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t];
  } else {
    groups = a.split(':');
  }
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return { key: `${groups.slice(0, 4).map((g) => g.padStart(4, '0')).join(':')}::/64`, v6: true };
}
