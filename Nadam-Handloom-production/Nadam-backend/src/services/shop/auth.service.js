// Website sign-in and sign-up (W1, web-01 section 4.1): one flow for both.
// 1. mobile → SMS code; 2. code → signed in (known customer) or "Complete your profile"
// (new customer, or an older account without the new details); 3. profile → signed in.
import { prisma } from '../../config/database.js';
import { SHOP, SHOP_CODE_PURPOSE } from '../../config/constants.js';
import * as Customer from '../../models/customer.model.js';
import * as codes from './code.service.js';
import * as sessions from './session.service.js';
import { resolvePlace } from './place.service.js';
import { signProfileStep, verifyProfileStep, stepExpiredError } from './token.service.js';
import { fullNameOf } from './present.js';
import { shopAudit } from '../audit.service.js';
import { describeUserAgent } from '../../utils/userAgent.js';
import { maskMobile } from '../../utils/phone.js';
import { badRequest, conflict, forbidden } from '../../utils/errors.js';

const emailTaken = () => conflict('EMAIL_TAKEN', 'This email is already on another account. Use a different one, or sign in with that account\'s mobile number. If it is yours, message us on WhatsApp.', { field: 'email', help: 'whatsapp' });
// A closed account that still has an owner or staff role (closed in the old app): opening
// it from the website would also give back the staff app. Only the shop owner can.
const closedTeamAccount = () => forbidden('ACCOUNT_MANAGED_BY_SHOP', 'This number belongs to a closed shop account. Please message us on WhatsApp.', { help: 'whatsapp' });
const stepUsed = () => badRequest('STEP_USED', 'You have already finished signing up. Please sign in with your mobile number.');

export function splitName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/* ---------- 1. Send the code ---------- */
export async function requestCode({ mobile, trap, ctx }) {
  if (trap) {
    // Bot trap: a hidden field people never fill. Same reply, nothing sent.
    await shopAudit('shop_bot_trap', { ctx, metadata: { step: 'code' } });
    return codes.decoyReply();
  }
  const account = await Customer.findByMobile(mobile);
  const reply = await codes.sendCode({ mobile, purpose: SHOP_CODE_PURPOSE.SIGN_IN, accountId: account?.id ?? null, ip: ctx.ip });
  await shopAudit('shop_code_sent', { accountId: account?.id ?? null, ctx, metadata: { mobile: maskMobile(mobile) } });
  return reply;
}

// What "Complete your profile" can fill in from an older account.
function prefillFrom(account) {
  if (!account || Customer.isClosed(account)) return { fullName: '', email: '', pincode: '', city: '', state: '', marketingOptIn: false };
  const p = account.userProfile;
  const a = account.adminProfile;
  return {
    fullName: fullNameOf(account) || [a?.firstName, a?.lastName].filter(Boolean).join(' ').trim(),
    email: account.email || '',
    pincode: p?.pincode || '',
    city: p?.city || '',
    state: p?.state || '',
    marketingOptIn: !!p?.marketingOptIn,
  };
}

/* ---------- 2. Check the code ---------- */
export async function verifyCode({ mobile, code, ctx }) {
  let row;
  try {
    row = await codes.verifyCode({ mobile, purpose: SHOP_CODE_PURPOSE.SIGN_IN, code });
  } catch (err) {
    await shopAudit('shop_code_failed', { ctx, metadata: { mobile: maskMobile(mobile), reason: err.code } });
    throw err;
  }
  const account = await Customer.findByMobile(mobile);
  if (account && Customer.isClosed(account) && Customer.isTeamMember(account)) throw closedTeamAccount();
  if (account && !Customer.isClosed(account)) await Customer.updateAccount(account.id, { phoneVerifiedAt: new Date() });

  if (account && Customer.hasCompleteProfile(account)) {
    const out = await sessions.start({ account, ctx });
    await shopAudit('shop_signed_in', { accountId: account.id, ctx });
    return { status: 'signed_in', ...out };
  }
  return {
    status: 'needs_profile',
    stepToken: signProfileStep({ mobile, accountId: account && !Customer.isClosed(account) ? account.id : null, codeId: row.id }),
    stepExpiresInSeconds: SHOP.PROFILE_STEP_MINUTES * 60,
    mobileMasked: maskMobile(mobile),
    prefill: prefillFrom(account),
  };
}

/* ---------- 3. Complete the profile ---------- */
const clip = (v, n) => (v ? String(v).trim().slice(0, n) || null : null);

export async function completeProfile({ stepToken, fullName, email, pincode, city, state, marketingOptIn, attribution = {}, ctx }) {
  const step = verifyProfileStep(stepToken);
  const place = await resolvePlace({ pincode, city, state });
  const { firstName, lastName } = splitName(fullName);
  const device = describeUserAgent(ctx.userAgent).device;
  const now = new Date();

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      await Customer.lockMobile(step.mobile, tx);
      let account = await Customer.findByMobile(step.mobile, tx);
      if (step.accountId && account?.id !== step.accountId) throw stepExpiredError(); // the number moved meanwhile
      if (account && Customer.isClosed(account) && Customer.isTeamMember(account)) throw closedTeamAccount();
      if (account && Customer.hasCompleteProfile(account)) {
        // This step was used already. A second tap or a retry after a lost reply signs in
        // to the same account without changing anything; a later replay is refused.
        const at = account.userProfile.privacyAcceptedAt;
        if (!at || Date.now() - at.getTime() > SHOP.PROFILE_REPEAT_SECONDS * 1000) throw stepUsed();
        return { accountId: account.id, created: false, repeat: true };
      }
      const holder = await Customer.findByEmail(email, tx);
      if (holder && holder.id !== account?.id) throw emailTaken();

      let created = false;
      if (!account) {
        account = await tx.authAccount.create({ data: { phone: step.mobile, email, status: 'active', phoneVerifiedAt: now } });
        created = true;
      } else {
        // A closed account (the same person, proven by the code) opens again.
        const reopen = Customer.isClosed(account) ? { status: 'active', deletedAt: null } : {};
        await Customer.updateAccount(account.id, { email, phoneVerifiedAt: now, ...reopen }, tx);
      }
      await Customer.ensureCustomerRole(account.id, tx);

      const before = created ? null : account.userProfile;
      const consentChanged = !before || before.marketingOptIn !== marketingOptIn;
      const firstTouch = (field, value) => (before?.[field] ? {} : { [field]: value });
      const details = {
        firstName, lastName, displayName: fullName,
        pincode: place.pincode, city: place.city, state: place.state,
        marketingOptIn, ...(consentChanged ? { marketingOptInAt: now } : {}),
        privacyAcceptedAt: now, lastSeenAt: now, deletedAt: null,
      };
      const signup = {
        ...firstTouch('signupSource', clip(attribution.source, 100)),
        ...firstTouch('signupMedium', clip(attribution.medium, 100)),
        ...firstTouch('signupCampaign', clip(attribution.campaign, 100)),
        ...firstTouch('signupReferrer', clip(attribution.referrer, 200)),
        ...firstTouch('signupDevice', device),
      };
      await Customer.upsertProfile(
        account.id,
        { ...details, ...signup, profileCompletedAt: now },
        { ...details, ...signup, ...(before?.profileCompletedAt ? {} : { profileCompletedAt: now }) },
        tx,
      );
      return { accountId: account.id, created };
    });
  } catch (err) {
    if (err?.code === 'P2002' && String(err?.meta?.target || err?.message).includes('email')) throw emailTaken();
    throw err;
  }

  const account = await Customer.findById(result.accountId);
  const out = await sessions.start({ account, ctx });
  if (result.repeat) return { status: 'signed_in', isNew: true, ...out };
  await shopAudit(result.created ? 'shop_account_created' : 'shop_profile_completed', {
    accountId: account.id, ctx, metadata: { pincodeKnown: place.known, marketingOptIn, source: account.userProfile?.signupSource || null, device },
  });
  return { status: 'signed_in', isNew: true, ...out };
}
