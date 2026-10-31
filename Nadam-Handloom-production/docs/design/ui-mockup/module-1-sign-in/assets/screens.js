/* The catalogue of Module 1 screens. Shared by the start page, the "Go to
   screen" menu, the review notes beside each screen and the device preview. */
window.NH_GROUPS = [
  { id: 'in', title: 'Getting in', who: 'Owner and staff', desc: 'Opening the app and signing in every day.' },
  { id: 'setup', title: 'First-time setup', who: 'Invited owner or staff', desc: 'The one-time setup on a new account.' },
  { id: 'recover', title: 'Recovery and protection', who: 'Owner and staff', desc: 'Forgotten PINs, locks, new phones and old 4-digit PINs.' },
  { id: 'signed', title: 'Signed in', who: 'Owner and staff', desc: 'Your account, PIN, devices and logging out.' },
  { id: 'system', title: 'System messages', who: 'Owner and staff', desc: 'What the app shows when something happens outside your control.' }
];

window.NH_SCREENS = [
  {
    id: 'splash', group: 'in', icon: 'sparkle', title: 'App opening',
    desc: 'Logo while the app checks whether this phone is still signed in.',
    purpose: 'Shown for about a second when the app starts. It goes straight to Home if the 7-day sign-in is still valid, otherwise to Sign in.',
    rules: ['Signed in within the last 7 days: go to Home, no PIN asked.', 'No internet but still signed in: open Home anyway with an offline banner. Nobody is signed out for a bad network.'],
    edges: ['Use the panel: "Sign out this phone" then reload, and you land on Sign in.', 'Turn on "No internet" while signed in: Home still opens.'],
    fixes: ['New: offline never signs anyone out (the old app showed sign-in when the network was down at launch).'],
    states: ['loading', 'error']
  },
  {
    id: 'signin', group: 'in', icon: 'lock', title: 'Sign in',
    desc: 'Mobile number and 6-digit PIN, or Face ID / fingerprint.',
    purpose: 'Daily sign-in. The phone remembers the last number, so most days it is just the PIN or Face ID.',
    rules: ['PIN is hidden as dots, with a show button.', '5 wrong tries per mobile number, then a lock: 15 min, then 30, then 60.', 'The error is the same for unknown numbers, so nobody can test which numbers are registered.', 'Old 4-digit PINs still work once, then must be upgraded.'],
    edges: ['Try 90000 00001 with a wrong PIN to see "tries left", then the lock.', 'Try 90000 00002 with 1357 to see the 4-digit upgrade.', 'Try any unknown number: same generic message.', 'Turn on "No internet" and press Sign in.'],
    fixes: ['PIN digits were visible on screen in the old app; now dots.', 'Tries are counted per number, not per shop Wi-Fi.'],
    states: ['loading', 'error', 'warning', 'success', 'popup']
  },
  {
    id: 'faceid', group: 'in', icon: 'faceid', title: 'Face ID / fingerprint',
    desc: 'The phone\'s own face or fingerprint check.',
    purpose: 'Signs in without typing the PIN, on a phone where it was turned on.',
    rules: ['3 failed tries, then it falls back to the PIN.', 'Turned off automatically if the phone\'s face or fingerprint settings change.', 'The face or fingerprint never leaves the phone.'],
    edges: ['Use the dashed "Simulate" chips to succeed or fail.', 'Switch the panel\'s phone type to Android to see fingerprint wording.'],
    fixes: ['New feature, not in the old app.'],
    states: ['error', 'success']
  },
  {
    id: 'locked', group: 'recover', icon: 'lock', title: 'Sign-in locked',
    desc: 'After 5 wrong PINs, with a countdown.',
    purpose: 'Stops PIN guessing. Shows exactly when sign-in opens again and offers Forgot PIN.',
    rules: ['Lock 1 lasts 15 min, lock 2 lasts 30 min, lock 3 onwards 60 min.', 'After a lock ends you get 5 fresh tries.', 'Forgot PIN unlocks straight away.'],
    edges: ['Use the "Skip timer" chip to end the lock.'],
    fixes: ['Old app: after a lock ended, one wrong PIN locked it again. Now 5 fresh tries.'],
    states: ['warning']
  },
  {
    id: 'newdevice', group: 'recover', icon: 'shield', title: 'New phone check',
    desc: 'Correct PIN on a phone that isn\'t trusted yet.',
    purpose: 'A PIN alone is never enough on an unknown phone: an SMS code to the account\'s number is also needed.',
    rules: ['After the code is verified, the phone becomes trusted.', 'Trusted phones are listed in My devices.'],
    edges: ['Turn on "Treat this phone as new" in the panel, then sign in.'],
    fixes: ['New protection, not in the old app.'],
    states: ['loading', 'error']
  },
  {
    id: 'activate', group: 'setup', icon: 'user', title: 'Set up your account',
    desc: 'Step 1: enter the mobile number the owner invited.',
    purpose: 'Starts first-time setup. The owner invites the number first (Module 2).',
    rules: ['Always shows the same reply, "If this number has been invited, a code is on its way", so it never reveals who is invited.'],
    edges: ['Use 90000 00003 (invited) to get a code.', 'Use an unknown number: same reply, but no SMS arrives.', 'Use 90000 00001 (already set up): a code arrives, then "Already set up".'],
    fixes: ['Old app said "Please use the registered mobile number", which told outsiders which numbers exist.'],
    states: ['loading', 'error']
  },
  {
    id: 'otp', group: 'setup', icon: 'message', title: 'Enter SMS code',
    desc: 'Step 2: the 6-digit code. Used for setup, Forgot PIN and new phones.',
    purpose: 'Proves the person holds the phone number.',
    rules: ['Sent and checked by Message Central (the live SMS provider). Valid 60 seconds, as decided earlier.', 'We stop after 3 wrong tries.', 'Resend after 60 seconds, checked by the server.', 'At most 5 codes per hour per number.', 'A new code cancels the old one.', 'Android reads the SMS automatically; iPhone offers it above the keyboard.'],
    edges: ['The SMS wording here is an example; Message Central sends its own wording.', 'Tap the SMS banner or the "From Messages" chip to fill the code.', 'Type a wrong code 3 times.', 'Use the "Expire code" chip.', 'Press Resend 5 times.'],
    fixes: ['Old app only checked the 60-second resend wait on the phone.'],
    states: ['loading', 'error', 'warning', 'success']
  },
  {
    id: 'setpin', group: 'setup', icon: 'key', title: 'Create your PIN',
    desc: 'Step 3: choose a 6-digit PIN and type it again.',
    purpose: 'Sets the PIN for daily sign-in. Also used for Forgot PIN and the 4-digit upgrade.',
    rules: ['6 digits.', 'Refused: all the same digit, straight runs (123456, 987654), or the last 6 digits of your own mobile number.', 'Typed twice to confirm.'],
    edges: ['Try 111111, 123456 or 000003 (for 90000 00003) to see the checklist fail.', 'Type a different PIN the second time.'],
    fixes: ['Old app allowed 4-digit PINs; now 6.'],
    states: ['error', 'popup']
  },
  {
    id: 'already', group: 'setup', icon: 'info', title: 'Already set up',
    desc: 'The number was set up before; offers Sign in or Reset PIN.',
    purpose: 'Shown only after the SMS code is verified, so only the phone\'s holder learns the account exists.',
    rules: [], edges: ['Start setup with 90000 00001.'], fixes: [], states: []
  },
  {
    id: 'biosetup', group: 'setup', icon: 'faceid', title: 'Turn on Face ID',
    desc: 'Step 4 (optional): faster sign-in on this phone.',
    purpose: 'Offers Face ID or fingerprint after the PIN is set. "Not now" is always available.',
    rules: ['Per phone. Can be turned on or off any time in My account.'],
    edges: ['Turn off "Phone has Face ID" in the panel and this step is skipped.'],
    fixes: ['New feature.'],
    states: ['error']
  },
  {
    id: 'done', group: 'setup', icon: 'check', title: 'You\'re all set',
    desc: 'Success screen after setup.',
    purpose: 'Confirms setup and explains that you stay signed in for 7 days, renewed every time you use the app.',
    rules: [], edges: [], fixes: [], states: []
  },
  {
    id: 'forgot', group: 'recover', icon: 'key', title: 'Forgot PIN',
    desc: 'Mobile number, then SMS code, then a new PIN.',
    purpose: 'Resets a forgotten PIN and clears any lock.',
    rules: ['Same generic reply as setup.', 'After reset: this phone is signed in, all other devices are signed out.'],
    edges: ['Use 90000 00001 and follow the steps.'],
    fixes: ['Old app made you sign in again after resetting; now you\'re signed in on this phone.'],
    states: ['loading', 'error']
  },
  {
    id: 'resetdone', group: 'recover', icon: 'shield', title: 'PIN reset',
    desc: 'Success screen: other devices were signed out.',
    purpose: 'Confirms the new PIN and tells the user their other devices were signed out for safety.',
    rules: [], edges: [], fixes: [], states: []
  },
  {
    id: 'upgrade', route: 'setpin?for=upgrade', group: 'recover', icon: 'key', title: 'Upgrade to a 6-digit PIN',
    desc: 'One-time step for anyone still on an old 4-digit PIN.',
    purpose: 'Existing team members keep their PIN; 4-digit ones are asked once to move to 6 digits.',
    rules: ['Shown right after a correct 4-digit sign-in, before Home.'],
    edges: ['Sign in with 90000 00002 and PIN 1357.'],
    fixes: ['Moves everyone to 6-digit PINs without anyone losing access.'],
    states: ['error']
  },
  {
    id: 'home', group: 'signed', icon: 'home', title: 'Home (placeholder)',
    desc: 'Where sign-in lands. The real Home is designed in Module 8.',
    purpose: 'Shows the signed-in shell: header, menu and offline banner. Content comes in later modules.',
    rules: ['Phone: bottom tab bar. Tablet: side menu.'],
    edges: ['Turn on "No internet": banner appears, nobody is signed out.', 'Use "Simulate 7 days unused" to see the safe-draft flow.'],
    fixes: [],
    states: ['loading', 'warning', 'success']
  },
  {
    id: 'account', group: 'signed', icon: 'user', title: 'My account',
    desc: 'Profile, Face ID switch, Change PIN, My devices, Log out.',
    purpose: 'Everything about your own sign-in in one place (the More tab).',
    rules: ['Log out always asks first.', 'Log out stays visible even if the profile fails to load.'],
    edges: ['Press Log out.', 'Use the Error state: Log out is still there.'],
    fixes: ['Old app: Log out had no confirmation, and vanished when the profile failed to load.'],
    states: ['loading', 'error', 'popup']
  },
  {
    id: 'changepin', group: 'signed', icon: 'key', title: 'Change PIN',
    desc: 'Current PIN, new PIN, confirm.',
    purpose: 'Change the PIN while signed in, without SMS.',
    rules: ['New PIN must differ from the current one.', '"Also sign out my other devices" is off by default.', 'Wrong current PIN counts toward the lock.'],
    edges: ['Current PIN for the owner sample: 246810.'],
    fixes: ['New feature: the old app only had Forgot PIN.'],
    states: ['error', 'success']
  },
  {
    id: 'devices', group: 'signed', icon: 'phone', title: 'My devices',
    desc: 'Where you\'re signed in; sign out any device.',
    purpose: 'See every phone and tablet signed in to your account, and sign out any of them.',
    rules: ['"This device" cannot be signed out here; use Log out.', '"Sign out all other devices" asks first.'],
    edges: ['Sign out the iPad, then the Empty state shows just this phone.'],
    fixes: ['New: the old app had the server parts but no screen.'],
    states: ['loading', 'empty', 'error', 'popup']
  },
  {
    id: 'expired', group: 'system', icon: 'clock', title: 'Please sign in again',
    desc: 'After 7 days unused. Unfinished work is kept.',
    purpose: 'The only time-based sign-out. Any half-done bill or form is saved on the phone and comes back after sign-in.',
    rules: ['Drafts stay for the same person; cleared if a different person signs in.'],
    edges: ['Sign in from here and the draft is restored on Home.'],
    fixes: ['New: unfinished work is never lost.'],
    states: []
  },
  {
    id: 'remote', group: 'system', icon: 'phone', title: 'Signed out from another device',
    desc: 'When you or the owner signed this phone out elsewhere.',
    purpose: 'Explains why sign-in is needed again.',
    rules: [], edges: [], fixes: [], states: []
  },
  {
    id: 'removed', group: 'system', icon: 'alert', title: 'Access removed',
    desc: 'When the owner removed this person from the team.',
    purpose: 'Shown on a phone that was signed in when access was removed (Module 2 does the removing).',
    rules: ['The sign-in keys are wiped from the phone.'],
    edges: [], fixes: [], states: []
  },
  {
    id: 'safety', group: 'system', icon: 'shield', title: 'Signed out for safety',
    desc: 'A copied sign-in was detected, so every device was signed out.',
    purpose: 'If the same sign-in key is used twice, it may have been copied. The server ends every session on the account, logs it, and every device shows this screen.',
    rules: ['All devices are signed out, including this one.', 'Sign in again with the PIN or Face ID.', 'An entry is written to the Activity log (Module 10).'],
    edges: ['Use the panel event "Copied sign-in detected", then check My devices after signing in.'],
    fixes: ['Old app: this was detected, but the app just dropped back to sign-in with no reason given.'],
    states: []
  },
  {
    id: 'server', route: 'signin?server=1', group: 'system', icon: 'clock', title: 'Server slow or down',
    desc: 'The server didn\'t answer. Nothing is lost and no one is signed out.',
    purpose: 'When the server is slow or down, the app waits (up to 30 seconds in the real app), then says so plainly.',
    rules: ['Nobody is signed out or locked because of a server problem.', 'A PIN try is not counted when the server didn\'t answer.', 'Phones already signed in keep working, with a banner.'],
    edges: ['Turn on "Server slow / down", then press Sign in.', 'Sign in first, then turn it on: Home shows a banner and nobody is signed out.'],
    fixes: ['Kept from the old app: a slow server never signs anyone out. New: a banner while signed in.'],
    states: []
  },
  {
    id: 'offline', route: 'signin?offline=1', group: 'system', icon: 'wifioff', title: 'No internet at sign-in',
    desc: 'Signing in needs internet; work on the phone is safe.',
    purpose: 'Sign-in itself needs the server. Phones that are already signed in keep working offline.',
    rules: [], edges: ['Turn "No internet" off in the panel and try again.'], fixes: [], states: []
  }
];

window.NH_SCREEN = function (id) { return window.NH_SCREENS.find(function (s) { return s.id === id; }); };
window.NH_ROUTE = function (s) { return s.route || s.id; };
