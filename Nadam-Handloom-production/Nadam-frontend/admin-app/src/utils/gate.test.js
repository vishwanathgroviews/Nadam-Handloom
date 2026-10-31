// Module 11: update rules and who maintenance stops.
import { decide, pausedFor } from './gate';

const status = (u, staff = { on: false, message: '' }) => ({ maintenance: { staff, website: { on: false } }, updates: { android: u, ios: { newest: 0, oldest: 0, required: false, link: 'https://x' } } });

describe('app updates (6.4)', () => {
  it('update required, a new version, or nothing', () => {
    expect(decide(status({ newest: 26, oldest: 26, required: false, link: 'https://p' }), 25, 'android')).toEqual({ mustUpdate: true, newVersion: false, link: 'https://p', need: 26 });
    expect(decide(status({ newest: 27, oldest: 0, required: false, link: 'https://p' }), 26, 'android')).toMatchObject({ mustUpdate: false, newVersion: true });
    expect(decide(status({ newest: 27, oldest: 0, required: true, link: 'https://p' }), 26, 'android')).toMatchObject({ mustUpdate: true, need: 27 });
    expect(decide(status({ newest: 26, oldest: 0, required: false, link: 'https://p' }), 26, 'android')).toMatchObject({ mustUpdate: false, newVersion: false });
    expect(decide(null, 26, 'android').mustUpdate).toBe(false);
    expect(decide(status({ newest: 99, oldest: 99 }), null, 'android').mustUpdate).toBe(false);
  });
});

describe('maintenance (6.3)', () => {
  it('staff are paused, owners never', () => {
    const s = { status: status({}, { on: true, message: 'Back at 6' }) };
    expect(pausedFor(s, { role: 'staff' })).toEqual({ message: 'Back at 6' });
    expect(pausedFor(s, { role: 'owner' })).toBeNull();
    expect(pausedFor({ status: status({}), paused: 'From the server' }, { role: 'staff' })).toEqual({ message: 'From the server' });
    expect(pausedFor({ status: status({}) }, { role: 'staff' })).toBeNull();
  });
});
