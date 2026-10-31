// Files in a local folder, served at /uploads (development and tests).
// remove() only ever deletes a file inside this folder, so replacing a photo on a
// copy of the live data can never touch a live file (those keys don't exist here).
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export function localStorage({ dir, publicUrl }) {
  const root = path.resolve(dir);
  const fileFor = (key) => {
    const full = path.resolve(root, key);
    if (!full.startsWith(root + path.sep)) throw new Error('Invalid storage key');
    return full;
  };
  return {
    name: 'local',
    root,
    async upload({ buffer, folder, ext }) {
      const key = `${folder}/${crypto.randomUUID()}.${ext}`;
      await fs.mkdir(path.dirname(fileFor(key)), { recursive: true });
      await fs.writeFile(fileFor(key), buffer);
      return { key, url: `${publicUrl}/uploads/${key}` };
    },
    async remove(key) {
      if (!key) return false;
      try {
        await fs.unlink(fileFor(key));
        return true;
      } catch {
        return false; // not ours (e.g. a live S3 key on the copied data), or already gone
      }
    },
    // A file this server stored, by its key; null when it isn't here (e.g. a live S3 key on
    // the copied data).
    async read(key) {
      if (!key) return null;
      try {
        return await fs.readFile(fileFor(key));
      } catch {
        return null;
      }
    },
    // A file this server stored, by its public address; null when it isn't one of ours.
    async readByUrl(url) {
      const prefix = `${publicUrl}/uploads/`;
      if (!url?.startsWith(prefix)) return null;
      return fs.readFile(fileFor(url.slice(prefix.length)));
    },
  };
}
