// Activity log (Module 10): Owners only (activity.view; the routes check it).
import * as activity from '../services/activity.service.js';

const send = (fn) => async (req, res, next) => {
  try {
    return res.json(await fn(req.valid || {}, req));
  } catch (err) {
    return next(err);
  }
};

export const list = send((v) => activity.list({ ...v, person: v.person ?? null, before: v.before ?? null }));
export const people = send((v) => activity.people(v));
