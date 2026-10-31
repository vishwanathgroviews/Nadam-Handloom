// Re-creates nandam_test from the local nandam_dev copy before the test run.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const PG = '/opt/homebrew/opt/postgresql@18/bin';
const run = (bin, args, opts = {}) => execFileSync(`${PG}/${bin}`, args, { stdio: 'pipe', ...opts });

export default function setup() {
  fs.rmSync('tmp/test-uploads', { recursive: true, force: true }); // photos and PDFs from the last run
  run('dropdb', ['--if-exists', '--force', 'nandam_test']);
  try {
    run('createdb', ['-T', 'nandam_dev', 'nandam_test']);
  } catch {
    // nandam_dev is in use (e.g. the dev server is running): copy it with dump/restore instead.
    run('createdb', ['nandam_test']);
    const dump = run('pg_dump', ['--format=custom', '--no-owner', 'nandam_dev'], { maxBuffer: 1024 * 1024 * 512 });
    run('pg_restore', ['--no-owner', '--dbname=nandam_test'], { input: dump });
  }
}
