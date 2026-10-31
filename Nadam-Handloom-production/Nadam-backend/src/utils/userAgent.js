// A short, human name for a browser from its user agent ("Chrome on Android"), and the
// kind of device (mobile / tablet / desktop) for the sign-up analytics. Good enough for
// the "Signed-in devices" list; never used for security decisions.
const BROWSERS = [
  [/EdgA?\/|Edg\//, 'Edge'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/OPR\/|Opera/, 'Opera'],
  [/FxiOS\/|Firefox\//, 'Firefox'],
  [/CriOS\/|Chrome\//, 'Chrome'],
  [/Version\/[\d.]+.*Safari\//, 'Safari'],
];
const SYSTEMS = [
  [/iPad/, 'iPad'],
  [/iPhone|iPod/, 'iPhone'],
  [/Android/, 'Android'],
  [/CrOS/, 'Chromebook'],
  [/Windows/, 'Windows'],
  [/Macintosh|Mac OS X/, 'Mac'],
  [/Linux/, 'Linux'],
];

export function describeUserAgent(ua) {
  const s = String(ua || '');
  const browser = BROWSERS.find(([re]) => re.test(s))?.[1] || null;
  const system = SYSTEMS.find(([re]) => re.test(s))?.[1] || null;
  let device = 'desktop';
  if (/iPad|Tablet/.test(s) || (/Android/.test(s) && !/Mobile/.test(s))) device = 'tablet';
  else if (/Mobi|iPhone|iPod|Android/.test(s)) device = 'mobile';
  const label = browser && system ? `${browser} on ${system}` : browser || system || 'Web browser';
  return { browser, system, device, label };
}
