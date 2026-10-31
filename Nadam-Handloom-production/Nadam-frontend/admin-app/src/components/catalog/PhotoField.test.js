// Category photos fit the website's home page card (3:4, like a saree card, 27 Oct 2026):
// the crop has no "whole photo", and a photo too small for the card gets a warning.
// Subcategory photos stay landscape tiles (4:3) with "Use the whole photo".
import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { PHOTO_SHAPES } from './PhotoField';
import { PhotoCropper } from './PhotoCropper';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const WHOLE = 'Use the whole photo';
const SMALL = /This photo is small/;

async function crop(photo, shape) {
  const s = PHOTO_SHAPES[shape];
  await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <ThemeProvider>
        <PhotoCropper photo={{ uri: 'file:///p.jpg', ...photo }} ratio={s.ratio} hint={s.hint} allowWhole={s.allowWhole} smallBelow={s.smallBelow} onDone={jest.fn()} onCancel={jest.fn()} />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

describe('category and subcategory photo shapes', () => {
  it('a category is the tall card (3:4) with its camera frame; a subcategory the landscape tile (4:3)', () => {
    expect(PHOTO_SHAPES.card).toMatchObject({ ratio: 3 / 4, framedCamera: true, allowWhole: false, thumb: { width: 54, height: 72 } });
    expect(PHOTO_SHAPES.tile).toMatchObject({ ratio: 4 / 3, framedCamera: false, allowWhole: true, thumb: { width: 72, height: 54 } });
  });

  it('a category photo must be cropped to the card: no "Use the whole photo"', async () => {
    await crop({ width: 3024, height: 4032 }, 'card');
    expect(screen.getByText('Use this crop')).toBeTruthy();
    expect(screen.queryByText(WHOLE)).toBeNull();
    expect(screen.getByText(/the card customers see on the website's home page/)).toBeTruthy();
  });

  it('a subcategory photo can still use the whole photo', async () => {
    await crop({ width: 4032, height: 3024 }, 'tile');
    expect(screen.getByText(WHOLE)).toBeTruthy();
  });

  it('a camera photo is big enough; a small one (like a 522 x 397 picture) is warned about', async () => {
    await crop({ width: 3024, height: 4032 }, 'card');
    expect(screen.queryByText(SMALL)).toBeNull();
    await crop({ width: 522, height: 397 }, 'card'); // the 3:4 cut is 298 x 397
    expect(screen.getByText(SMALL)).toBeTruthy();
  });

  it('a WhatsApp-size photo (1600 x 1200) is fine for the card: the cut is 900 x 1200', async () => {
    await crop({ width: 1600, height: 1200 }, 'card');
    expect(screen.queryByText(SMALL)).toBeNull();
  });
});
