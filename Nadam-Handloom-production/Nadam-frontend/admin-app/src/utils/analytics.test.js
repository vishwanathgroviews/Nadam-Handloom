// Module 9: change against the period before, lakhs, bar lengths, chart labels.
import { changeText, lakh, share, maxOf, labelEvery } from './analytics';

describe('the change against the period before (6.3)', () => {
  it('up, down, same, nothing to compare', () => {
    expect(changeText(112, 100, '1–12 Sep 2026')).toEqual({ text: '↑ 12% vs 1–12 Sep 2026', tone: 'up' });
    expect(changeText(92, 100, 'the 7 days before')).toEqual({ text: '↓ 8% vs the 7 days before', tone: 'down' });
    expect(changeText(100, 100, 'yesterday')).toEqual({ text: 'Same as yesterday', tone: 'same' });
    expect(changeText(266098, 3600, 'the 6 days before')).toEqual({ text: '↑ 74× vs the 6 days before', tone: 'up' });
    expect(changeText(50, 0, 'yesterday')).toEqual({ text: 'No sales yesterday', tone: 'none' });
    expect(changeText(50, 0, 'August', true)).toEqual({ text: 'Nothing to compare yet', tone: 'none' });
  });
});

describe('money, bars and labels', () => {
  it('lakhs for big sums, rupees below', () => {
    expect(lakh(241996)).toBe('₹2.41 lakh');
    expect(lakh(6446324)).toBe('₹64.46 lakh');
    expect(lakh(96500)).toBe('₹96,500');
  });
  it('bar lengths against the largest; small but visible for tiny values', () => {
    expect(share(50, 200)).toBe(25);
    expect(share(1, 100000)).toBe(2);
    expect(share(0, 100)).toBe(0);
    expect(share(5, 0)).toBe(0);
    expect(maxOf([{ amount: 3 }, { amount: 9 }, {}])).toBe(9);
  });
  it('every label up to 16 bars, then about six', () => {
    expect(labelEvery(12)).toBe(1);
    expect(labelEvery(30)).toBe(5);
  });
});
