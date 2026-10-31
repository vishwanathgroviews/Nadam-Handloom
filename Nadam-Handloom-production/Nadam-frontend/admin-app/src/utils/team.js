// Wording for the team screens, kept in one place (docs Module 2, sections 4 and 5).
import { ago, dateText, lastActiveText } from './time';

export const ROLE_LABEL = { owner: 'Owner', staff: 'Staff' };

// What each role can do, in plain words (the permission table, section 4).
export const CAN_DO = {
  staff: {
    can: ['Products: view, add, edit and delete', 'Orders: today and past, and shipping', 'Scan to sell and share invoices', 'See categories and prices'],
    cant: ['Sales totals, sales summaries and analytics', 'The team', 'Changing categories or prices', 'Activity log and settings'],
  },
  owner: {
    can: ['Everything Staff can do', 'Today\'s sales, sales summaries and analytics', 'The team: invite, change roles, remove', 'Categories and prices', 'Activity log and settings'],
    cant: [],
  },
};

export const canDoText = (role) => {
  const c = CAN_DO[role];
  return [...c.can.map((x) => `• ${x}`), ...(c.cant.length ? ['', `Owners only: ${c.cant.join(', ').toLowerCase()}.`] : [])].join('\n');
};

export function nameError(name) {
  const v = String(name || '').trim().replace(/\s+/g, ' ');
  if (v.length < 2) return 'Enter their full name (at least 2 letters).';
  if (v.length > 80) return 'Keep the name under 80 characters.';
  if (!/\p{L}/u.test(v)) return 'Enter a name with letters in it.';
  if (/[<>]/.test(v)) return 'Remove the < > characters from the name.';
  return null;
}
export const cleanName = (name) => String(name || '').trim().replace(/\s+/g, ' ');
export const firstName = (name) => cleanName(name).split(' ')[0];

// The line under a name in the team list.
export function memberSubline(m, now = Date.now()) {
  if (m.status === 'invited') return `${ROLE_LABEL[m.role]} · Invited ${ago(m.invitedAt, now)}`;
  if (m.status === 'removed') return m.removedAt ? `Removed ${dateText(m.removedAt)}` : 'Removed';
  // Your own row: you are using the app right now.
  return `${m.isMainOwner ? 'Main owner' : ROLE_LABEL[m.role]} · ${m.isYou ? 'Active now' : lastActiveText(m.lastActiveAt, now)}`;
}

export const STATUS_BADGE = {
  active: { text: 'Active', tone: 'success' },
  invited: { text: 'Invited', tone: 'warning' },
  removed: { text: 'Removed', tone: 'danger' },
};

// Facts on the member page: "Added …", "Last active …", "Invited … by …", "Removed … by …".
export function memberFacts(m, now = Date.now()) {
  const facts = [`Added ${dateText(m.addedAt)}`];
  if (m.status === 'active') facts.push(lastActiveText(m.lastActiveAt, now));
  if (m.status === 'invited') facts.push(`Invited ${ago(m.invitedAt, now)}${m.invitedBy ? ` by ${firstName(m.invitedBy.name)}` : ''}. Not set up yet.`);
  if (m.status === 'removed') facts.push(`Removed${m.removedAt ? ` ${dateText(m.removedAt)}` : ''}${m.removedBy ? ` by ${firstName(m.removedBy.name)}` : ''}`);
  return facts;
}

export const teamSummary = (counts) =>
  `${counts.owners} owner${counts.owners === 1 ? '' : 's'} · ${counts.staff} staff${counts.invited ? ` · ${counts.invited} invited` : ''}`;
