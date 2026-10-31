// Subcategories as cards, two side by side (three on a tablet): photo, badges, name, counts,
// store and website price; a tap opens the subcategory.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { SubGrid, gridSize } from './SubGrid';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const sub = (over) => ({
  id: 's1', name: 'GAP BORDER DIGITAL PRINT', categoryName: 'Mangalagiri Handloom Pattu Sarees', productCount: 81, inStockCount: 57,
  storePrice: 3300, websitePrice: 2600, imageUrl: 'https://example.test/gap.jpg', showOnWebsite: true, hasPhoto: true, ...over,
});

describe('the subcategory grid', () => {
  it('two cards a row on a phone, three on a tablet, never wider than the page', () => {
    expect(gridSize(390)).toEqual({ columns: 2, cardWidth: 169 }); // (390 - 40 - 12) / 2
    expect(gridSize(360).columns).toBe(2);
    expect(gridSize(820)).toEqual({ columns: 3, cardWidth: 232 }); // (760 - 40 - 24) / 3
    expect(gridSize(1366)).toEqual(gridSize(820)); // the content stops at 760
  });

  it('each card: the big photo, name, counts and both prices; badges when hidden or without a photo; a tap opens it', async () => {
    const onOpen = jest.fn();
    await render(
      <ThemeProvider>
        <SubGrid items={[sub(), sub({ id: 's2', name: '50/50 BANDINI', imageUrl: null, hasPhoto: false, showOnWebsite: false, inStockCount: 0, productCount: 1 })]} onOpen={onOpen} />
      </ThemeProvider>,
    );
    expect(screen.getByText('GAP BORDER DIGITAL PRINT')).toBeTruthy();
    expect(screen.getByText('81 products · 57 in stock')).toBeTruthy();
    expect(screen.getAllByText('₹3,300')).toHaveLength(2); // both cards share the sample price
    expect(screen.getAllByText('Web ₹2,600')).toHaveLength(2);
    expect(screen.getByText('1 product')).toBeTruthy();
    expect(screen.getByText('Hidden')).toBeTruthy();
    expect(screen.getByText('Needs photo')).toBeTruthy();
    expect(screen.queryByText('Mangalagiri Handloom Pattu Sarees')).toBeNull(); // only in the search
    expect(screen.getByTestId('sub-photo-s1').props.source).toEqual({ uri: 'https://example.test/gap.jpg' });
    expect(screen.queryByTestId('sub-photo-s2')).toBeNull(); // no photo: the placeholder
    await fireEvent.press(screen.getByLabelText('50/50 BANDINI, store ₹3,300, website ₹2,600, hidden, needs photo'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 's2' }));
  });

  it('in the search across the catalogue, each card also names its category', async () => {
    await render(<ThemeProvider><SubGrid items={[sub()]} showCategory onOpen={() => {}} /></ThemeProvider>);
    expect(screen.getByText('Mangalagiri Handloom Pattu Sarees')).toBeTruthy();
  });
});
