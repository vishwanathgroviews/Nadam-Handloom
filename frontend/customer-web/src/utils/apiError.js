// What to show the customer when the server turns a request down.
//
// A form that fails the server's checks comes back with the generic message
// "Validation failed" and the actual reasons in `details` ([{ path, message }]).
// The reason is the part worth reading — "This MPIN is too easy to guess,
// please choose another" tells the customer what to do next, where
// "Validation failed" left them guessing and trying the OTP again instead.
//
// Only that one case is unwrapped: other errors carry details of their own
// shape alongside a message that is already the specific one.
export const apiErrorMessage = (data) => {
  if (data?.message === 'Validation failed' && Array.isArray(data.details)) {
    const reason = data.details.find((detail) => detail?.message)?.message;
    if (reason) return reason;
  }
  return data?.message || 'Something went wrong';
};
