// Collects who/where details used by audit entries and sessions.
// The app sends X-Device-Id, X-Platform and X-App-Version on every request.
// Every request gets an id (X-Request-Id), so an error the customer reports can be found in the log.
import crypto from 'node:crypto';

const DEVICE_ID = /^[A-Za-z0-9._:-]{8,100}$/;
const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

export function requestContext(req, res, next) {
  const given = req.get('x-request-id');
  req.id = given && REQUEST_ID.test(given) ? given : crypto.randomUUID();
  res.set('X-Request-Id', req.id);
  const deviceId = req.get('x-device-id');
  const platform = req.get('x-platform');
  req.ctx = {
    ip: req.ip,
    userAgent: (req.get('user-agent') || '').slice(0, 300) || null,
    deviceId: deviceId && DEVICE_ID.test(deviceId) ? deviceId : null,
    platform: platform === 'ios' || platform === 'android' ? platform : null,
    appVersion: (req.get('x-app-version') || '').slice(0, 40) || null,
  };
  next();
}
