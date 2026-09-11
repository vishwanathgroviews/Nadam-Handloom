import type { ViewStyle } from 'react-native';

// Radius scale lifted from the source design: small thumbnails/inputs at
// 12-16px, the dominant row/tile card at 22px, larger content sections at
// 24px, hero/prominent panels at 28px, and fully-rounded pills/avatars.
export const radius = {
  sm: 12,
  md: 16,
  lg: 22,
  xl: 24,
  xxl: 28,
  pill: 999,
};

type Shadow = Pick<ViewStyle, 'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'>;

// The source design uses warm brown-tinted shadows (rgba(70,45,30,x)) in
// place of borders, plus a maroon-tinted glow under primary CTAs and a
// darker one under the floating bottom nav.
export const shadow: Record<'card' | 'raised' | 'floating' | 'brand', Shadow> = {
  card: {
    shadowColor: '#462D1E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  raised: {
    shadowColor: '#462D1E',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.09,
    shadowRadius: 20,
    elevation: 6,
  },
  floating: {
    shadowColor: '#321E14',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 10,
  },
  brand: {
    shadowColor: '#7A1F2B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
};
