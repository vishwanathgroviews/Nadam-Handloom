// Module 2 rules that need no database: the permission table, statuses, names
// and the invite message.
import { describe, it, expect } from 'vitest';
import { permissionsFor, can, PERMISSION } from '../../src/config/permissions.js';
import { statusOf, splitName } from '../../src/services/team.service.js';
import { inviteMessage, whatsappUrl } from '../../src/services/inviteMessage.js';

describe('permission table (plan 4)', () => {
  it('owners can do everything', () => {
    expect(permissionsFor('ADMIN')).toEqual(Object.values(PERMISSION));
  });
  it('staff: catalogue view, products, orders, selling. Nothing with money totals', () => {
    expect([...permissionsFor('STAFF')].sort()).toEqual(['catalog.view', 'orders.manage', 'products.manage', 'sell.use']);
    for (const p of ['team.manage', 'sales.view', 'analytics.view', 'activity.view', 'settings.manage', 'catalog.edit', 'sell.override']) expect(can('STAFF', p)).toBe(false);
  });
  it('anyone else gets nothing', () => {
    expect(permissionsFor('CUSTOMER')).toEqual([]);
    expect(permissionsFor(null)).toEqual([]);
  });
});

describe('status (plan 7)', () => {
  const role = (name) => ({ role: { name } });
  const acc = (o = {}) => ({ roles: [role('STAFF')], status: 'active', mpinHash: 'h', deletedAt: null, adminProfile: { invitedAt: null }, trustedDevices: [], ...o });
  it('Removed: no Owner or Staff role', () => expect(statusOf(acc({ roles: [role('CUSTOMER')] }))).toBe('removed'));
  it('Invited: role but no PIN yet', () => expect(statusOf(acc({ status: 'pending', mpinHash: null }))).toBe('invited'));
  it('Active: role and PIN (people from before the team screens)', () => expect(statusOf(acc())).toBe('active'));
  it('a customer with a PIN is Invited until they sign in on a phone after the invite', () => {
    const invitedAt = new Date('2026-10-11T10:00:00Z');
    expect(statusOf(acc({ adminProfile: { invitedAt }, trustedDevices: [{ trustedAt: new Date('2026-10-01T10:00:00Z') }] }))).toBe('invited');
    expect(statusOf(acc({ adminProfile: { invitedAt }, trustedDevices: [{ trustedAt: new Date('2026-10-11T11:00:00Z') }] }))).toBe('active');
  });
});

describe('names', () => {
  it('first word is the first name, the rest the last name', () => {
    expect(splitName('Ravi Kumar Naidu')).toEqual({ firstName: 'Ravi', lastName: 'Kumar Naidu' });
    expect(splitName('Suresh')).toEqual({ firstName: 'Suresh', lastName: '' });
  });
});

describe('invite message (plan 5.2)', () => {
  const base = { firstName: 'Suresh', role: 'staff', mobile: '9000000003', fromName: 'Lakshmi Devi' };
  it('new person: install, set up, SMS code, choose a PIN; signed by the owner', () => {
    const m = inviteMessage({ ...base, hasPin: false, appLink: 'https://example.com/app' });
    expect(m).toBe([
      'Hi Suresh, you\'ve been added to the Nandam Handlooms team as Staff.', '', 'To get started:',
      '1. Install the Nandam Handlooms Admin app: https://example.com/app',
      '2. Open it and tap "First time here? Set up your account".',
      '3. Enter your mobile number 90000 00003. You\'ll get an SMS code.',
      '4. Choose your own 6-digit PIN.', '',
      'Never share your PIN or SMS code with anyone, including me.', '', '– Lakshmi Devi, Nandam Handlooms',
    ].join('\n'));
  });
  it('website customer: sign in with the PIN they already use', () => {
    const m = inviteMessage({ ...base, role: 'owner', hasPin: true, appLink: undefined });
    expect(m).toContain('as an Owner.');
    expect(m).toContain('1. Install the Nandam Handlooms Admin app.\n');
    expect(m).toContain('2. Sign in with your mobile number 90000 00003 and the PIN you use on our website.');
    expect(m).not.toContain('First time here?');
  });
  it('never contains a code or PIN', () => {
    // Apart from their own mobile number, no run of 4 or more digits.
    const m = inviteMessage({ ...base, hasPin: false }).replace('90000 00003', '');
    expect(m).not.toMatch(/\d{4,}/);
  });
  it('WhatsApp link goes to +91 and the number, with the text encoded', () => {
    expect(whatsappUrl('9000000003', 'Hi & bye')).toBe('https://wa.me/919000000003?text=Hi%20%26%20bye');
  });
});
