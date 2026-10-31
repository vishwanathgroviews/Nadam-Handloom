// Every failure the website can meet, as one shape: { status, code, message, details,
// retryAfterSeconds, reference, field }. `message` is plain English to show as is.

export class ApiError extends Error {
  constructor({ status = 0, code = 'UNKNOWN', message, details = null, retryAfterSeconds = null, reference = null }) {
    super(message || 'Something went wrong. Please try again.');
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryAfterSeconds = retryAfterSeconds;
    this.reference = reference;
  }

  // The form field this error belongs to, when the server says so.
  get field() {
    return this.details?.field || this.details?.issues?.[0]?.field || null;
  }

  // { fieldName: message } for every field the server refused.
  get fieldErrors() {
    const out = {};
    for (const i of this.details?.issues || []) if (i.field && !out[i.field]) out[i.field] = i.message;
    if (this.details?.field && !out[this.details.field]) out[this.details.field] = this.message;
    return out;
  }
}

// The sign-in has ended for good: the website must ask the customer to sign in again.
export const SESSION_ENDED = new Set([
  'NOT_SIGNED_IN', 'SESSION_INVALID', 'SESSION_EXPIRED', 'SESSION_ENDED', 'SIGNED_OUT',
  'SIGNED_OUT_REMOTELY', 'SIGNED_OUT_EVERYWHERE', 'SIGNED_OUT_FOR_SAFETY', 'ACCOUNT_DELETED',
]);

export const offlineError = () => new ApiError({ code: 'OFFLINE', message: 'You are offline. Check your internet connection and try again. What you typed is kept.' });
export const networkError = () => new ApiError({ code: 'NETWORK', message: 'We couldn\'t reach Nandam Handlooms. Check your connection and try again.' });
export const timeoutError = () => new ApiError({ code: 'TIMEOUT', message: 'This is taking too long. Please try again.' });

export function serverError(status, reference) {
  if (status === 502 || status === 503 || status === 504) {
    return new ApiError({ status, code: 'SERVER_BUSY', message: 'Our server is busy right now. Please try again in a minute.', reference });
  }
  return new ApiError({ status, code: 'SERVER', message: 'Something went wrong on our side. Please try again.', reference });
}

// "Try again in 3 minutes" / "in 40 seconds".
export function waitText(seconds) {
  if (!seconds || seconds <= 0) return 'now';
  if (seconds < 90) return `${seconds} seconds`;
  const m = Math.ceil(seconds / 60);
  return m === 1 ? '1 minute' : `${m} minutes`;
}
