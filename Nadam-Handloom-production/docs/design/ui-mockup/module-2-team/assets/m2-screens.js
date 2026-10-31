/* The catalogue of Module 2 (Roles and team) screens. Shared by the start page,
   the "Go to screen" menu, the review notes beside each screen and the device preview. */
window.NH_GROUPS = [
  { id: 'team', title: 'Team list', who: 'Owners', desc: 'Everyone who can use the admin app, and adding new people.' },
  { id: 'member', title: 'A team member', who: 'Owners', desc: 'Name, role, phones, removing and inviting again.' },
  { id: 'staff', title: 'What Staff see', who: 'Staff', desc: 'The same app with owner-only parts left out.' },
  { id: 'other', title: 'The other person\'s phone', who: 'The person changed', desc: 'What someone sees after the owner changes their access.' }
];

window.NH_SCREENS = [
  {
    id: 'more', group: 'team', icon: 'more', title: 'More (owner)',
    desc: 'My account, with the new Team row for owners.',
    purpose: 'Team lives under More, next to My account. Only owners see the Team row.',
    rules: ['Team row shows how many people are in the team and how many are still invited.', 'Staff never see the Team row (see "More (staff)").'],
    edges: ['Switch "View the app as" to Ravi (staff): the Team row disappears.'],
    fixes: ['Old app: the Team screen was a separate menu item that staff could open and then got an error.'],
    states: ['loading', 'error']
  },
  {
    id: 'team', group: 'team', icon: 'users', title: 'Team',
    desc: 'Everyone with access: role, status and when they were last active.',
    purpose: 'One list of owners and staff. Invited people show until they finish setting up.',
    rules: ['Two tabs: Team (Active and Invited) and Removed.', 'Search by name or mobile number.', 'Main owner marked with a crown. "You" marks your own row.', 'Sorted: owners first, then staff, then by name.'],
    edges: ['Type "ravi" or "00002" in search.', 'Search for "xyz" to see "No one matches".', 'Switch "Team list style" in Design options between A rows and B cards.', 'Use Screen states: Loading, Empty, Error.'],
    fixes: ['Old app showed only staff, with no last-active time and no way to see removed people.'],
    states: ['loading', 'empty', 'error']
  },
  {
    id: 'removedtab', route: 'team?tab=removed', group: 'team', icon: 'users', title: 'Team · Removed tab',
    desc: 'People whose access was removed. Their history is kept.',
    purpose: 'Shows who was removed and when, and lets an owner invite them again.',
    rules: ['Removed people keep all their sales, invoices and activity history.', 'Open a person to invite them again.'],
    edges: ['Open Kiran and press "Invite again".'],
    fixes: ['Old app deleted the link to the person, so history showed an unknown name.'],
    states: ['empty']
  },
  {
    id: 'invite', group: 'team', icon: 'userplus', title: 'Invite someone',
    desc: 'Name, mobile number and role. Explains what each role can do.',
    purpose: 'Adds a person as Invited. Nothing is sent by SMS: the next screen shares the invite on WhatsApp.',
    rules: ['Name 2–80 characters.', 'Mobile: 10 digits starting 6, 7, 8 or 9. It can\'t be changed later.', 'Role: Staff (default) or Owner.'],
    edges: ['Enter 90000 00002 (Ravi): "Already in your team".', 'Enter 90000 00003 (Suresh): "Already invited", with Share again.', 'Enter 90000 00004 (Kiran, removed): invited again.', 'Enter 90000 00009 (a website customer): added, keeps the customer account.', 'Turn on "No internet" and press Invite.'],
    fixes: ['Old app promised "an SMS will be sent", but no SMS was ever sent.', 'Old app could only add Staff, never another Owner.'],
    states: ['loading', 'error']
  },
  {
    id: 'invited', group: 'team', icon: 'send', title: 'Invite ready to share',
    desc: 'Share the invite on WhatsApp, or any other app. Free.',
    purpose: 'The owner sends the invite from their own phone, so there\'s no SMS cost and the person knows who it\'s from.',
    rules: ['"Share invite on WhatsApp" opens WhatsApp to that number with the message filled in. You press Send.', '"Share another way" opens the phone\'s share menu (SMS, email, copy).', 'The invite never contains a code or password. The person still needs an SMS code to set up.'],
    edges: ['Press "Share invite on WhatsApp" to see the message as it will appear.', 'Press Done (top right): the person shows as Invited in the list.'],
    fixes: ['New: invites reach people at no cost.'],
    states: []
  },
  {
    id: 'whatsapp', group: 'team', icon: 'whatsapp', title: 'WhatsApp message',
    desc: 'The ready-made message as it opens in WhatsApp.',
    purpose: 'Shows the exact invite wording. WhatsApp itself is outside our app; this is a picture of it.',
    rules: ['Steps: install the app, tap "First time here?", enter your number, get the SMS code, choose a PIN.', 'Signed with the owner\'s name.'],
    edges: ['Press Send (pretend) to come back to the app.'],
    fixes: [],
    states: []
  },
  {
    id: 'member', route: 'member?id=ravi', group: 'member', icon: 'user', title: 'Member · active staff',
    desc: 'Ravi: role, phones, sign out, remove.',
    purpose: 'Everything an owner can do for one person.',
    rules: ['Edit name. The mobile number can\'t be changed.', 'Make Owner / Make Staff asks first. The person stays signed in.', 'Sign out one phone or all. That phone then needs the PIN and an SMS code.', 'Remove access asks first, ends every sign-in, and keeps history.'],
    edges: ['Make Ravi an Owner, then view the app as Ravi: a "Your role changed" message and the owner screens appear.', 'Sign out the Counter tablet.', 'Remove access, then view the app as Ravi.', 'Use Screen states: Loading, Error, Pop-up.'],
    fixes: ['Old app had no way to see or sign out a staff member\'s phones.'],
    states: ['loading', 'error', 'popup', 'success']
  },
  {
    id: 'memberinvited', route: 'member?id=suresh', group: 'member', icon: 'send', title: 'Member · invited',
    desc: 'Suresh hasn\'t set up yet: share the invite again.',
    purpose: 'Helps when the person lost the message or hasn\'t started.',
    rules: ['Share invite again (WhatsApp or another way).', 'Cancel the invite = Remove access.', 'Becomes Active by itself when they set their PIN.'],
    edges: ['Press "Share invite again".', 'Use "Simulate: Suresh finishes setup" to see it turn Active.'],
    fixes: [],
    states: []
  },
  {
    id: 'memberremoved', route: 'member?id=kiran', group: 'member', icon: 'user', title: 'Member · removed',
    desc: 'Kiran was removed: history kept, invite again.',
    purpose: 'Bring a person back without losing their history.',
    rules: ['Invite again restores the chosen role. They set up again with an SMS code and a new PIN.'],
    edges: ['Press "Invite again" and pick a role.'],
    fixes: [],
    states: []
  },
  {
    id: 'memberowner', route: 'member?id=priya', group: 'member', icon: 'crown', title: 'Member · another owner',
    desc: 'Priya (owner). The main owner can hand over the main-owner title.',
    purpose: 'Owners manage each other, but nobody can remove or demote the main owner.',
    rules: ['Only the main owner sees "Make main owner", and only on another active owner\'s page.', 'After the hand-over the old main owner stays an Owner.', 'Nobody else can remove the main owner, make them Staff or sign out their phones.'],
    edges: ['View the app as Priya and open Lakshmi: no Remove, no Make Staff, no phone sign-out, a "Protected" note.', 'As Lakshmi, make Priya the main owner, then open your own page.'],
    fixes: ['Old app: "make someone else an owner first" was impossible, because nobody could make an owner.'],
    states: ['popup']
  },
  {
    id: 'moreStaff', route: 'more?as=ravi', group: 'staff', icon: 'more', title: 'More (staff)',
    desc: 'Staff see My account, but no Team.',
    purpose: 'Staff manage their own PIN, phones and Face ID only.',
    rules: ['No Team row. The server also refuses every team action for Staff.'],
    edges: ['Compare with "More (owner)".'],
    fixes: [],
    states: []
  },
  {
    id: 'homeStaff', route: 'home?as=ravi', group: 'staff', icon: 'home', title: 'Home (staff)',
    desc: 'No money totals for Staff.',
    purpose: 'Shows which Home tiles each role gets. Home itself is designed in Module 8.',
    rules: ['Staff: no Today\'s sales, no sales summary, no Analytics.', 'Staff: Orders, Scan to sell, Products, invoices.'],
    edges: ['Switch "View the app as" between Lakshmi and Ravi.'],
    fixes: ['Old app showed today\'s sales to everyone.'],
    states: []
  },
  {
    id: 'noaccess', route: 'noaccess?as=ravi', group: 'staff', icon: 'lock', title: 'Owners only',
    desc: 'If Staff ever reach an owner-only screen.',
    purpose: 'Normally Staff never see a way in. This covers old links, or a role changed while the screen was open.',
    rules: ['The server says "not allowed for your role"; the app shows this calmly instead of an error.'],
    edges: [],
    fixes: ['Old app showed a red error toast.'],
    states: []
  },
  {
    id: 'rolechanged', route: 'home?as=anil&changed=1', group: 'other', icon: 'info', title: 'Role changed',
    desc: 'The person stays signed in; the app updates its screens.',
    purpose: 'When an owner changes someone\'s role, that person isn\'t signed out. Their app switches screens the next time it checks in.',
    rules: ['Checks in when a screen opens or the app comes back to the front.', 'A short message says what changed.'],
    edges: ['Opening this screen makes Anil an Owner (as if Lakshmi did it) and shows Anil\'s phone. Use Reset demo to undo.', 'Or: as Lakshmi, change Ravi\'s role, then view the app as Ravi.'],
    fixes: [],
    states: []
  },
  {
    id: 'removedmsg', route: 'removed', group: 'other', icon: 'alert', title: 'Access removed',
    desc: 'The removed person\'s phone, on its next action (from Module 1).',
    purpose: 'Removal works at once, on every phone.',
    rules: ['Sign-in keys and Face ID are wiped from the phone.', 'Their unsaved work on the phone is not sent.'],
    edges: ['Remove Ravi, then view the app as Ravi.'],
    fixes: [],
    states: []
  }
];

window.NH_SCREEN = function (id) { return window.NH_SCREENS.find(function (s) { return s.id === id; }); };
window.NH_ROUTE = function (s) { return s.route || s.id; };
