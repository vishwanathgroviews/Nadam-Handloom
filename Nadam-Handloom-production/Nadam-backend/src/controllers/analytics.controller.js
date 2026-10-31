// Analytics (Module 9): Owners only (analytics.view; the routes check it).
import * as analytics from '../services/analytics.service.js';

const send = (fn) => async (req, res, next) => {
  try {
    return res.json(await fn(req.valid || {}, req));
  } catch (err) {
    return next(err);
  }
};

export const summary = send((v) => analytics.summary(v));
export const person = send((v) => analytics.personFigures(v));
export const stock = send(() => analytics.stock());
