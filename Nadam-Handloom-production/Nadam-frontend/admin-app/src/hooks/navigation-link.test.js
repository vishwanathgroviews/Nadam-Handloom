// A page opened straight from a link (or the app restarted on it) still has the
// tabs underneath, so Back and the iPhone swipe go to Home instead of nowhere.
// Its own file: one app per test file (see navigation.testkit.js).
import { router } from 'expo-router';
import { open, go, at, signedInStack } from './navigation.testkit';

it('a sale opened from a link has Home underneath', async () => {
  await open('/scan/sale/5');
  at('/scan/sale/5');
  expect(signedInStack()).toEqual(['(tabs)', 'scan/sale/[id]']);
  expect(router.canGoBack()).toBe(true);
  await go(() => router.back());
  at('/home');
});
