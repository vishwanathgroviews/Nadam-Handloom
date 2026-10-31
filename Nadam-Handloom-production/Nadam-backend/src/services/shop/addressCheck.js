// Website W6: can an order be sent to this saved address? An address saved on the old website
// can have a wrong state or a short line: it must be corrected first. Used by Pay and by the
// address list (so the checkout page can say so before Pay).
import { INDIAN_STATES } from '../../config/constants.js';
import { normalizeMobile } from '../../utils/phone.js';

export function addressProblem(a) {
  if (!a.fullName || a.fullName.trim().length < 2) return { field: 'fullName', message: 'Add the name for delivery.' };
  if (!normalizeMobile(a.phone)) return { field: 'mobile', message: 'Add a 10-digit mobile number for delivery.' };
  if (!a.line1 || a.line1.trim().length < 3) return { field: 'line1', message: 'Add the house, flat or building.' };
  if (!/^[1-9]\d{5}$/.test(String(a.pincode || ''))) return { field: 'pincode', message: 'Add a valid 6-digit pincode.' };
  if (!a.city || a.city.trim().length < 2) return { field: 'city', message: 'Add the city or town.' };
  if (!INDIAN_STATES.includes(a.state)) return { field: 'state', message: 'Choose the state.' };
  return null;
}
