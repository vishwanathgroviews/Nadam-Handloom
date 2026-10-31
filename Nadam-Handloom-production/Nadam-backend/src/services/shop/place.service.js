// Pincode → city and state (W1). The customer may correct the city and state; for a
// pincode not in India Post's list they type them (web-01 section 6).
import * as Pincode from '../../models/pincode.model.js';
import { notFound, badRequest } from '../../utils/errors.js';

export async function lookup(pincode) {
  const p = await Pincode.find(pincode);
  if (!p) throw notFound('PINCODE_NOT_FOUND', 'We couldn\'t find this pincode. Check it, or type your city and state.');
  return { pincode: p.pincode, area: p.area, city: p.city, state: p.state };
}

// The place to save: the customer's own city and state when given, else the directory's.
export async function resolvePlace({ pincode, city, state }) {
  const p = await Pincode.find(pincode);
  if (p) return { pincode, city: city || p.city, state: state || p.state, known: true };
  if (!city || !state) {
    throw badRequest('PINCODE_NOT_FOUND', 'We couldn\'t find this pincode. Check it, or type your city and state.', { field: 'pincode' });
  }
  return { pincode, city, state, known: false };
}
