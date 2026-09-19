import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { AUDIT_GROUPS } from './auditLog.groups';

// Every event the staff app records must belong to a filter group, or it
// would only ever appear under "All". This fails the moment someone adds a
// new staff-app event without deciding where it is filtered.
describe('audit log filter groups', () => {
  const sourceFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) return sourceFiles(full);
      return /\.ts$/.test(name) && !/\.test\.ts$/.test(name) ? [full] : [];
    });

  it('covers every event type the staff app records', () => {
    const grouped = new Set(Object.values(AUDIT_GROUPS).flat());
    const missing = new Set<string>();

    for (const file of sourceFiles(path.join(__dirname, '..'))) {
      const text = readFileSync(file, 'utf8');
      // Each logAuthEvent({ ... }) call: its eventType(s) and its source.
      for (const call of text.split('logAuthEvent({').slice(1)) {
        const body = call.slice(0, call.indexOf('});') + 1);
        if (!/source:\s*'staff_app'/.test(body)) continue;
        for (const m of body.matchAll(/'([a-z]+(?:_[a-z]+)+)'/g)) {
          const type = m[1]!;
          if (type === 'staff_app' || type === 'customer_web') continue;
          if (!grouped.has(type as never)) missing.add(type);
        }
      }
    }

    expect([...missing]).toEqual([]);
  });

  it('puts no event type in two groups', () => {
    const all = Object.values(AUDIT_GROUPS).flat();
    expect(new Set(all).size).toBe(all.length);
  });
});
