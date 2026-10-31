// Module 11: the shop details form, "last changed", the warning before requiring a version.
import { shopErrors, shopKey, mobileText, lastChanged, olderPhones, phoneText, advancedError, needOf } from './settings';

describe('shop details (6.5)', () => {
  it('each field checked like the server', () => {
    expect(shopErrors({ name: 'Nandam Handlooms', address: 'Hussain Katta, Mangalagiri', mobile: '+91 94941 70180', gstin: '37ccwpn2487c1z2', website: '' })).toEqual({});
    expect(Object.keys(shopErrors({ name: 'N', address: 'x', mobile: '123', gstin: 'ABC', website: 'nandam.com' }))).toEqual(['name', 'address', 'mobile', 'gstin', 'website']);
    expect(shopErrors({ name: 'Nandam', address: 'Hussain Katta, Mangalagiri', mobile: '9494170180', gstin: '37CCWPN2487C1Z2', website: 'https://nandamhandlooms.com/' })).toEqual({});
    expect(mobileText('9494170180')).toBe('+91 94941 70180');
  });
  it('"Nothing changed" when only spaces or capitals differ', () => {
    const a = { name: 'Nandam  Handlooms', address: 'Hussain Katta', mobile: '+91 94941 70180', gstin: '37ccwpn2487c1z2', website: 'https://x.com/' };
    const b = { name: 'Nandam Handlooms', address: 'Hussain Katta', mobile: '9494170180', gstin: '37CCWPN2487C1Z2', website: 'https://x.com' };
    expect(shopKey(a)).toBe(shopKey(b));
    expect(shopKey({ ...b, mobile: '9494170181' })).not.toBe(shopKey(b));
  });
});

describe('last changed', () => {
  it('who and when; before this module only the time', () => {
    expect(lastChanged({ by: 'Lakshmi', when: '12 Oct 2026, 3:10 pm' }, 'Never changed')).toBe('Lakshmi, 12 Oct 2026, 3:10 pm');
    expect(lastChanged({ by: null, when: '4 Oct 2026, 11:02 am' }, 'x')).toBe('4 Oct 2026, 11:02 am · person not recorded');
    expect(lastChanged(null, 'Never changed')).toBe('Never changed');
  });
});

describe('app updates (6.4)', () => {
  const phones = [
    { person: 'Ravi', name: 'Redmi Note 12', platform: 'android', build: 25 },
    { person: 'Anil', name: 'Galaxy A14', platform: 'android', build: 26 },
    { person: 'Shop', name: 'iPad', platform: 'ios', build: 6 },
    { person: 'Sita', name: 'Moto G', platform: 'android', build: null },
  ];
  it('older phones on the same platform are named; unknown versions counted', () => {
    const r = olderPhones(phones, 'android', 26);
    expect(r.older.map(phoneText)).toEqual(['Ravi · Redmi Note 12 (25)']);
    expect(r.unknown).toBe(1);
    expect(olderPhones(phones, 'ios', 7).older).toHaveLength(1);
  });
  it('advanced numbers and link checked; the version phones need after a change', () => {
    expect(advancedError({ newest: '26', oldest: '25', link: '' })).toBeNull();
    expect(advancedError({ newest: '25', oldest: '26', link: '' })).toMatch(/oldest/);
    expect(advancedError({ newest: '', oldest: '0', link: '' })).toMatch(/whole numbers/);
    expect(advancedError({ newest: '26', oldest: '0', link: 'http://x' })).toMatch(/https/);
    expect(needOf({ newest: 27, oldest: 25, required: false })).toBe(25);
    expect(needOf({ newest: 27, oldest: 25, required: true })).toBe(27);
  });
});
