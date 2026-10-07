import { describe, expect, it } from 'vitest';
import { CommonActions, StackActions, StackRouter } from '@react-navigation/routers';
import { goToTab } from './tabs';

// The real router the app's outer stack runs on, driven the way a screen's
// `navigation` object drives it — so these tests see exactly which screens
// would be left mounted on a phone, without needing one.
const makeStack = () => {
  const router = StackRouter({ initialRouteName: 'Home' });
  const options = {
    routeNames: ['Home', 'ProductForm', 'Categories'],
    routeParamList: {},
    routeGetIdList: {},
  };
  let state = router.getInitialState(options);
  const apply = (action: any) => {
    const next = router.getStateForAction(state, action, options);
    if (!next) throw new Error(`Router refused ${action.type}`);
    state = next as typeof state;
  };
  return {
    open: (name: string) => apply(StackActions.push(name)),
    navigation: { navigate: (...args: any[]) => apply((CommonActions.navigate as any)(...args)) },
    screens: () => state.routes.map((route) => route.name),
    top: () => state.routes[state.index]!,
  };
};

describe('goToTab', () => {
  it('goes back to the tabs that are already open instead of opening another copy', () => {
    const stack = makeStack();
    stack.open('ProductForm');

    goToTab(stack.navigation, 'ProductsTab');

    expect(stack.screens()).toEqual(['Home']);
    expect(stack.top().params).toEqual({ screen: 'ProductsTab' });
  });

  // What a morning of adding stock does: New product, save, back to the
  // list, again. Each round used to leave a form and a set of tabs behind.
  it('leaves nothing behind after saving thirty products in a row', () => {
    const stack = makeStack();

    for (let saved = 0; saved < 30; saved++) {
      stack.open('ProductForm');
      goToTab(stack.navigation, 'ProductsTab');
    }

    expect(stack.screens()).toEqual(['Home']);
  });

  it('unwinds everything stacked above the tabs, however deep', () => {
    const stack = makeStack();
    stack.open('Categories');
    stack.open('ProductForm');

    goToTab(stack.navigation, 'OrdersTab', { tab: 'to_ship' });

    expect(stack.screens()).toEqual(['Home']);
    expect(stack.top().params).toEqual({ screen: 'OrdersTab', params: { tab: 'to_ship' } });
  });

  it('just switches tab when the tabs are already on top', () => {
    const stack = makeStack();

    goToTab(stack.navigation, 'ScannerTab');

    expect(stack.screens()).toEqual(['Home']);
    expect(stack.top().params).toEqual({ screen: 'ScannerTab' });
  });
});
