// The invite the owner shares from their own phone on WhatsApp (or any other app).
// It never holds a code or a password: the person still proves the number is
// theirs with an SMS code when they set up (Module 1).
import { env } from '../config/env.js';

const spaced = (m) => `${m.slice(0, 5)} ${m.slice(5)}`;

// hasPin: the number already has a PIN (a website customer), so they sign in
// with it instead of setting up a new one.
export function inviteMessage({ firstName, role, mobile, hasPin, fromName, appLink = env.INVITE_APP_LINK }) {
  const steps = [`Install the Nandam Handlooms Admin app${appLink ? `: ${appLink}` : '.'}`];
  if (hasPin) {
    steps.push(`Sign in with your mobile number ${spaced(mobile)} and the PIN you use on our website.`);
    steps.push('You\'ll get an SMS code to confirm your phone.');
  } else {
    steps.push('Open it and tap "First time here? Set up your account".');
    steps.push(`Enter your mobile number ${spaced(mobile)}. You'll get an SMS code.`);
    steps.push('Choose your own 6-digit PIN.');
  }
  return [
    `Hi ${firstName}, you've been added to the Nandam Handlooms team as ${role === 'owner' ? 'an Owner' : 'Staff'}.`,
    '',
    'To get started:',
    ...steps.map((s, i) => `${i + 1}. ${s}`),
    '',
    'Never share your PIN or SMS code with anyone, including me.',
    '',
    `– ${fromName}, Nandam Handlooms`,
  ].join('\n');
}

// Opens WhatsApp on the owner's phone, to this number, with the message typed in.
export const whatsappUrl = (mobile, text) => `https://wa.me/91${mobile}?text=${encodeURIComponent(text)}`;
