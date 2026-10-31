// The start-up check (Module 11): must this phone update, is a new version out, is the
// staff app paused for this person. Kept here so they can be tested.

// Update required below the oldest allowed, or below the newest when "required" is on.
export function decide(status, build, platform) {
  const u = status?.updates?.[platform];
  if (!u || !build) return { mustUpdate: false, newVersion: false, link: u?.link || null, need: null };
  const mustUpdate = build < (u.oldest || 0) || (u.required && build < (u.newest || 0));
  return { mustUpdate, newVersion: !mustUpdate && build < (u.newest || 0), link: u.link || null, need: Math.max(u.oldest || 0, u.required ? u.newest || 0 : 0) || null };
}

// Staff only: owners keep working while the staff app is paused (6.3).
export function pausedFor(state, user) {
  if (!user || user.role === 'owner') return null;
  const m = state?.status?.maintenance?.staff;
  if (m?.on) return { message: m.message };
  return state?.paused ? { message: state.paused } : null;
}
