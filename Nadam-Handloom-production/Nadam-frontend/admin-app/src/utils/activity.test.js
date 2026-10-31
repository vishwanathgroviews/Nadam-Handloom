// Module 10: the filter summary, day titles, links, day headers.
import { DEFAULT_VIEW, filterSummary, dayTitle, linkHref, withDays } from './activity';

describe('the filter summary', () => {
  it('nothing chosen, or each choice in order', () => {
    expect(filterSummary(DEFAULT_VIEW)).toEqual({ count: 0, text: 'Everything, last 30 days' });
    expect(filterSummary({ ...DEFAULT_VIEW, kind: 'sales', person: 'x', personName: 'Ravi', period: '7d', important: true })).toEqual({ count: 4, text: 'Sales · Ravi · 7 days · Important only' });
    expect(filterSummary({ ...DEFAULT_VIEW, period: 'custom', custom: { from: '2026-10-01', to: '2026-10-05' } }).text).toBe('2026-10-01 – 2026-10-05');
  });
});

describe('days and links', () => {
  it('Today, Yesterday, then the date (month ends too)', () => {
    expect(dayTitle('2026-10-12', '12 Oct 2026', '2026-10-12')).toBe('Today');
    expect(dayTitle('2026-10-11', '11 Oct 2026', '2026-10-12')).toBe('Yesterday');
    expect(dayTitle('2026-09-30', '30 Sept 2026', '2026-10-01')).toBe('Yesterday');
    expect(dayTitle('2026-10-10', '10 Oct 2026', '2026-10-12')).toBe('10 Oct 2026');
  });
  it('Open goes to the sale, order, saree, design, person or invoice', () => {
    expect(linkHref({ type: 'sale', id: 's1' })).toBe('/scan/sale/s1?back=%2Fmore%2Factivity');
    expect(linkHref({ type: 'design', id: 'd1' })).toBe('/products/sub/d1?back=%2Fmore%2Factivity');
    expect(linkHref({ type: 'person', id: 'p1' })).toBe('/more/team/p1');
    expect(linkHref(null)).toBeNull();
  });
  it('a header before each new day', () => {
    const rows = withDays([{ id: 'a', day: '2026-10-12', date: '12 Oct 2026' }, { id: 'b', day: '2026-10-12', date: '12 Oct 2026' }, { id: 'c', day: '2026-10-10', date: '10 Oct 2026' }], '2026-10-12');
    expect(rows.map((r) => r.header || r.key)).toEqual(['Today', 'a', 'b', '10 Oct 2026', 'c']);
  });
});
