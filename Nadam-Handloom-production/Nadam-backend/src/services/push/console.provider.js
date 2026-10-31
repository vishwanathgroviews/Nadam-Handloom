// Test-mode push: nothing is sent; each message is kept in `outbox` (tests read it) and,
// outside tests, printed in the log. A token starting "invalid-" acts like one Firebase
// says is gone.
import { env } from '../../config/env.js';

export const outbox = [];

export const consolePush = {
  name: 'console',
  async send(message) {
    if (message.token.startsWith('invalid-')) return { ok: false, invalidToken: true, error: 'UNREGISTERED' };
    outbox.push(message);
    if (!env.isTest) console.log(`[push:test-mode] "${message.title}" to …${message.token.slice(-6)}`);
    return { ok: true, id: `console-${outbox.length}` };
  },
};
