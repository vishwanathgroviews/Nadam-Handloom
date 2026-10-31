// The last Settings page loaded, so Shop details opens with it straight away.
let last = null;
export const settingsCache = { get: () => last, set: (r) => { last = r; } };
