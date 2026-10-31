// Shared by the navigation tests (not part of the app). It runs Expo Router's own
// navigation over the REAL list of pages in src/app, with each page swapped for a
// stand-in, so no camera, server or sign-in is needed.
//
// One app per test file: Expo Router keeps its router in one shared place, and a
// second app started in the same file never gets it back.
import fs from 'fs';
import path from 'path';
import { Text } from 'react-native';
import { Stack, Tabs, useNavigation } from 'expo-router';
import { act, renderRouter } from 'expo-router/testing-library';

export const APP = path.join(__dirname, '..', 'app');
export const SIGNED_IN = path.join(APP, '(app)');
export const TAB_PAGES = ['home', 'orders', 'scan', 'products', 'more'];

export const filesUnder = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const full = path.join(dir, e.name);
  return e.isDirectory() ? filesUnder(full) : e.name.endsWith('.js') ? [full] : [];
});
export const routeKey = (file) => path.relative(APP, file).replace(/\.js$/, '').split(path.sep).join('/');

// The same layouts as the real ones, minus sign-in and the custom tab bar.
// Each stand-in notes which kind of navigator holds it (useTabBarSpace relies on it).
export const holder = {};
const page = (key) => function StandIn() {
  holder[key] = useNavigation().getState()?.type;
  return <Text>{`page:${key}`}</Text>;
};
function buildApp() {
  const ctx = {
    _layout: () => <Stack screenOptions={{ headerShown: false }} />,
    '(app)/_layout': {
      default: () => (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="scan/sold" options={{ gestureEnabled: false }} />
        </Stack>
      ),
      unstable_settings: { initialRouteName: '(tabs)' },
    },
    '(app)/(tabs)/_layout': () => (
      <Tabs screenOptions={{ headerShown: false }}>
        {TAB_PAGES.map((t) => <Tabs.Screen key={t} name={t} />)}
      </Tabs>
    ),
  };
  for (const file of filesUnder(SIGNED_IN)) {
    const key = routeKey(file);
    if (!key.endsWith('_layout')) ctx[key] = page(key);
  }
  return ctx;
}

let app;
// renderRouter runs on fake timers, and the router is only ready once pending
// promises have run; after that each change settles when the timers run.
export const open = async (initialUrl) => {
  app = renderRouter(buildApp(), { initialUrl });
  await act(async () => { await Promise.resolve(); });
  act(() => { jest.runAllTimers(); });
  return app;
};
export const go = async (fn) => {
  await act(async () => { fn(); });
  act(() => { jest.runAllTimers(); });
};
export const at = (pathname) => expect(app.getPathname()).toBe(pathname);

// The signed-in stack: the tabs at the bottom, pages on top.
export const signedInStack = () => {
  let s = app.getRouterState();
  while (s && !s.routes.some((x) => x.name === '(tabs)')) s = s.routes[s.index ?? 0].state;
  return s.routes.map((x) => x.name);
};
