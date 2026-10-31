// /api/v2/team: owners manage who can use the admin app (access token + team.manage).
import { Router } from 'express';
import * as c from '../controllers/team.controller.js';
import * as v from '../validators/team.validators.js';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/authenticate.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { PERMISSION } from '../config/permissions.js';

const r = Router();
r.use(authenticate, requirePermission(PERMISSION.TEAM_MANAGE));

const member = validate(v.memberParams, 'params');
r.get('/', validate(v.listQuery, 'query'), c.list);
r.post('/', validate(v.inviteBody), c.invite);
r.get('/:id', member, c.get);
r.patch('/:id', member, validate(v.renameBody), c.rename);
r.put('/:id/role', member, validate(v.roleBody), c.changeRole);
r.post('/:id/remove', member, c.remove);
r.post('/:id/reinvite', member, validate(v.reinviteBody), c.reinvite);
r.post('/:id/main-owner', member, c.makeMainOwner);
r.post('/:id/devices/sign-out-all', member, c.signOutAllPhones);
r.delete('/:id/devices/:deviceId', validate(v.memberDeviceParams, 'params'), c.signOutPhone);

export default r;
