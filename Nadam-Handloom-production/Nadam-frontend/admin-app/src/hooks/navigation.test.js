// How pages open and where Back goes (15 Oct 2026: the testers' "swipe from the edge
// doesn't go back on iPhone" and "Add sarees on Home does nothing").
//
// The rule: the five tabs sit at the bottom of one stack and every other page opens on
// top of the page it was opened from. The iPhone swipe, Android's back and the Back
// arrow all pop that stack, so they return to that page, whichever tab it was in.
import fs from 'fs';
import path from 'path';
import { router } from 'expo-router';
import { backTarget } from './useBack';
import { SIGNED_IN, TAB_PAGES, filesUnder, routeKey, open, go, at, signedInStack, holder } from './navigation.testkit';

describe('the page layout on disk', () => {
  it('has the five tabs, and nothing else, in the tabs group', () => {
    const inTabs = fs.readdirSync(path.join(SIGNED_IN, '(tabs)')).sort();
    expect(inTabs).toEqual(['_layout.js', ...TAB_PAGES.map((t) => `${t}.js`)].sort());
  });

  it('has no other page stacks, so every other page opens on top of the tabs', () => {
    const layouts = filesUnder(SIGNED_IN).filter((f) => path.basename(f) === '_layout.js').map(routeKey).sort();
    expect(layouts).toEqual(['(app)/(tabs)/_layout', '(app)/_layout']);
  });

  it('keeps the tabs underneath a page opened straight from a link', () => {
    const src = fs.readFileSync(path.join(SIGNED_IN, '_layout.js'), 'utf8');
    expect(src).toMatch(/unstable_settings\s*=\s*\{\s*initialRouteName:\s*'\(tabs\)'\s*\}/);
    expect(src).toMatch(/<Stack[\s>]/);
  });

  it('points Home\'s "Add sarees" at the first step, choosing the subcategory', () => {
    const src = fs.readFileSync(path.join(SIGNED_IN, '(tabs)', 'home.js'), 'utf8');
    expect(src.match(/\['Add sarees', '[^']+', '([^']+)'\]/)[1]).toBe('/products/add/pick');
  });
});

// One working session through the app (see navigation.testkit.js for why it is one test).
it('opens every page on top of the one it came from, and Back returns there', async () => {
  await open('/home');
  at('/home');

  // Home → Add sarees: the first step, on top of Home; Back returns to Home.
  await go(() => router.push('/products/add/pick'));
  at('/products/add/pick');
  expect(signedInStack()).toEqual(['(tabs)', 'products/add/pick']);
  expect(router.canGoBack()).toBe(true);
  await go(() => router.back());
  at('/home');
  expect(signedInStack()).toEqual(['(tabs)']);

  // Pages that live in other tabs, opened from Home, return to Home (not to that tab).
  for (const href of ['/scan/today?back=home', '/scan/price-check?back=home', '/orders/unpaid?back=home', '/more/analytics?back=home', '/scan/sale/7?back=home', '/products/sub/3?back=home', '/home/low']) {
    await go(() => router.push(href));
    at(href.split('?')[0]);
    await go(() => router.back());
    at('/home');
  }

  // Pages opened one after another come back one at a time.
  await go(() => router.push('/scan/today?back=home'));
  await go(() => router.push('/scan/sale/42'));
  await go(() => router.push('/products/7'));
  at('/products/7');
  expect(signedInStack()).toEqual(['(tabs)', 'scan/today', 'scan/sale/[id]', 'products/[id]']);
  await go(() => router.back());
  at('/scan/sale/42');
  await go(() => router.back());
  at('/scan/today');
  await go(() => router.back());
  at('/home');

  // A page opened from inside a tab goes back to that tab.
  await go(() => router.navigate('/scan'));
  at('/scan');
  await go(() => router.push('/scan/price-check'));
  await go(() => router.back());
  at('/scan');
  await go(() => router.navigate('/more'));
  await go(() => router.push('/more/team'));
  await go(() => router.push('/more/team/9'));
  await go(() => router.back());
  at('/more/team');
  await go(() => router.back());
  at('/more');

  // After a sale, Next customer (dismiss all) returns to the Sell screen it started from.
  await go(() => router.navigate('/scan'));
  await go(() => router.push('/scan/bill'));
  await go(() => router.push('/scan/complete'));
  await go(() => router.replace('/scan/sold?id=1'));
  at('/scan/sold');
  await go(() => router.dismissAll());
  at('/scan');
  expect(signedInStack()).toEqual(['(tabs)']);

  // "Back to Products" from the adding steps (and "Hide" while saving) returns to the
  // Products tab with nothing left on top, even when adding was started from Home.
  await go(() => router.navigate('/home'));
  await go(() => router.push('/products/add/pick'));
  await go(() => router.replace('/products/add/start?id=3'));
  await go(() => router.replace('/products/add/scan'));
  await go(() => router.push('/products/add/review'));
  at('/products/add/review');
  await go(() => router.dismissTo('/products'));
  at('/products');
  expect(signedInStack()).toEqual(['(tabs)']);

  // My account → "Turn on Face ID" (asks for the PIN, 16 Oct 2026) opens on top; Back returns.
  await go(() => router.navigate('/more'));
  await go(() => router.push({ pathname: '/more/face-id', params: { label: 'Face ID' } }));
  at('/more/face-id');
  expect(signedInStack()).toEqual(['(tabs)', 'more/face-id']);
  await go(() => router.back());
  at('/more');
  expect(signedInStack()).toEqual(['(tabs)']);

  // "Go to Home" on an owners-only page a staff member opened.
  await go(() => router.navigate('/more'));
  await go(() => router.push('/more/team'));
  await go(() => router.dismissTo('/home'));
  at('/home');
  expect(signedInStack()).toEqual(['(tabs)']);

  // Home's to-do links that open a tab switch tabs, they don't stack anything.
  await go(() => router.push('/orders?tab=to_ship'));
  at('/orders');
  expect(signedInStack()).toEqual(['(tabs)']);

  // The main pages sit in the tabs (they keep room for the floating bar); the pages
  // opened on top sit in the stack (they don't).
  expect(holder['(app)/(tabs)/home']).toBe('tab');
  expect(holder['(app)/(tabs)/orders']).toBe('tab');
  expect(holder['(app)/more/team/index']).toBe('stack');
  expect(holder['(app)/more/face-id']).toBe('stack');
  expect(holder['(app)/products/add/pick']).toBe('stack');
});

// From a page on top, navigate()/replace() to a tab opens a SECOND copy of the tabs on
// top (Expo Router pushes). Going back to a tab must use dismissTo().
it('never sends anyone to a tab with navigate() or replace() from the signed-in pages', () => {
  const files = [...filesUnder(SIGNED_IN), ...filesUnder(path.join(SIGNED_IN, '..', '..', 'components'))];
  const offenders = files.filter((f) => !f.includes(`${path.sep}(tabs)${path.sep}`))
    .flatMap((f) => fs.readFileSync(f, 'utf8').split('\n').map((line, i) => [f, i + 1, line]))
    .filter(([, , line]) => /router\.(navigate|replace)\(\s*['`]\/(home|orders|scan|products|more)['`?]/.test(line))
    .map(([f, n]) => `${path.relative(SIGNED_IN, f)}:${n}`);
  expect(offenders).toEqual([]);
});

describe('where Back goes when there is no page before', () => {
  it('follows ?back=, then the screen\'s own fallback, then Home', () => {
    expect(backTarget('home')).toBe('/home');
    expect(backTarget('/more/activity?kind=signin')).toBe('/more/activity?kind=signin');
    expect(backTarget(undefined, '/products')).toBe('/products');
    expect(backTarget('elsewhere')).toBe('/home');
    expect(backTarget(undefined)).toBe('/home');
  });
});
