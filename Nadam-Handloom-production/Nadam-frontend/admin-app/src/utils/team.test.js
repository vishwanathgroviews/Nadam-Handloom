// Team wording: names, the line under each person, facts, summary, role texts.
import { nameError, cleanName, firstName, memberSubline, memberFacts, teamSummary, canDoText, CAN_DO } from './team';
import { ago, lastActiveText } from './time';

const NOW = new Date('2026-10-11T12:00:00Z').getTime();
const hoursAgo = (h) => new Date(NOW - h * 3600_000).toISOString();

test('names: 2-80 characters with letters, no < >', () => {
  expect(nameError('A')).toMatch(/at least 2/);
  expect(nameError('12345')).toMatch(/letters/);
  expect(nameError('<b>x</b>')).toMatch(/< >/);
  expect(nameError('x'.repeat(81))).toMatch(/80/);
  expect(nameError('  Ravi   Kumar ')).toBeNull();
  expect(cleanName('  Ravi   Kumar ')).toBe('Ravi Kumar');
  expect(firstName('Ravi Kumar')).toBe('Ravi');
});

test('time words', () => {
  expect(ago(hoursAgo(0.01), NOW)).toBe('just now');
  expect(ago(hoursAgo(0.5), NOW)).toBe('30 min ago');
  expect(ago(hoursAgo(3), NOW)).toBe('3 hours ago');
  expect(ago(hoursAgo(48), NOW)).toBe('2 days ago');
  expect(ago(hoursAgo(24 * 60), NOW)).toMatch(/2026/);
  expect(lastActiveText(null, NOW)).toBe('Not signed in yet');
  expect(lastActiveText(hoursAgo(0), NOW)).toBe('Active now');
  expect(lastActiveText(hoursAgo(3), NOW)).toBe('Last active 3 hours ago');
});

test('the line under each person in the list', () => {
  expect(memberSubline({ status: 'active', role: 'staff', lastActiveAt: hoursAgo(3) }, NOW)).toBe('Staff · Last active 3 hours ago');
  expect(memberSubline({ status: 'active', role: 'owner', isMainOwner: true, lastActiveAt: hoursAgo(0) }, NOW)).toBe('Main owner · Active now');
  expect(memberSubline({ status: 'active', role: 'owner', isYou: true, lastActiveAt: hoursAgo(1) }, NOW)).toBe('Owner · Active now');
  expect(memberSubline({ status: 'invited', role: 'owner', invitedAt: hoursAgo(48) }, NOW)).toBe('Owner · Invited 2 days ago');
  expect(memberSubline({ status: 'removed', removedAt: '2026-09-10T10:00:00Z' }, NOW)).toBe('Removed 10 Sept 2026');
});

test('facts on the member page', () => {
  const f = memberFacts({ status: 'invited', addedAt: '2026-10-09T10:00:00Z', invitedAt: hoursAgo(48), invitedBy: { name: 'Lakshmi Devi' } }, NOW);
  expect(f[1]).toBe('Invited 2 days ago by Lakshmi. Not set up yet.');
  expect(memberFacts({ status: 'removed', addedAt: '2025-02-01T10:00:00Z', removedAt: null, removedBy: null }, NOW)[1]).toBe('Removed');
});

test('team summary and role texts', () => {
  expect(teamSummary({ owners: 1, staff: 3, invited: 1 })).toBe('1 owner · 3 staff · 1 invited');
  expect(teamSummary({ owners: 2, staff: 0, invited: 0 })).toBe('2 owners · 0 staff');
  expect(canDoText('staff')).toContain('Owners only: sales totals');
  expect(canDoText('owner')).not.toContain('Owners only');
  expect(CAN_DO.staff.can).toContain('Products: view, add, edit and delete');
});
