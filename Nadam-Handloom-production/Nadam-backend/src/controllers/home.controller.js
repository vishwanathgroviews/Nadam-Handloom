// Home (Module 8): everyone signed in; the reply depends on the role (staff get no
// money totals). Running low is Owners only (the route checks sales.view).
import * as home from '../services/home.service.js';

const send = (fn) => async (req, res, next) => {
  try {
    return res.json(await fn(req));
  } catch (err) {
    return next(err);
  }
};

export const get = send((req) => home.home({ viewer: req.auth.account }));
export const stock = send(() => home.runningLow());
