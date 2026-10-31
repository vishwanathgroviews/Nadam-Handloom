import { Appearance, Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';
import { themePref } from '../theme/themePref';
import { ThemeChoice } from './ThemeChoice';

// Saved phone settings live in memory during the tests (Jest moves this above the imports).
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

// Shows which theme the app is drawing, next to the picker.
function Drawn() {
  const { scheme, c } = useTheme();
  return <Text testID="drawn">{`${scheme} ${c.bg}`}</Text>;
}

it('picking Light, Dark or Auto changes the colours the whole app draws', async () => {
  jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});
  await themePref.load();
  await render(<ThemeProvider><ThemeChoice /><Drawn /></ThemeProvider>);
  const drawn = () => screen.getByTestId('drawn').props.children;

  expect(screen.getByRole('radio', { name: 'Auto, follows the phone' }).props.accessibilityState.selected).toBe(true);
  const autoLook = drawn();

  await act(async () => { await fireEvent.press(screen.getByRole('radio', { name: 'Dark' })); });
  expect(drawn()).toMatch(/^dark /);
  expect(screen.getByRole('radio', { name: 'Dark' }).props.accessibilityState.selected).toBe(true);
  expect(Appearance.setColorScheme).toHaveBeenLastCalledWith('dark');

  await act(async () => { await fireEvent.press(screen.getByRole('radio', { name: 'Light' })); });
  expect(drawn()).toMatch(/^light /);

  await act(async () => { await fireEvent.press(screen.getByRole('radio', { name: 'Auto, follows the phone' })); });
  expect(drawn()).toBe(autoLook);
  expect(Appearance.setColorScheme).toHaveBeenLastCalledWith('unspecified');
});
