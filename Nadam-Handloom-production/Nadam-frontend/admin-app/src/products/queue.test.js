// The upload queue with sets (15 Oct 2026): a listing carries all its tags, the tags
// waiting to upload are all blocked, and Fix replaces only the tag the server refused.
import { queue, pendingTags } from './queue';
import * as productsApi from '../api/products';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@react-native-community/netinfo', () => ({ addEventListener: jest.fn() }));
jest.mock('../api/products', () => ({ createProduct: jest.fn(), checkTags: jest.fn() }));
jest.mock('./photos', () => ({ removePhoto: jest.fn() }));
jest.mock('../auth/session', () => ({ session: { getState: () => ({ user: { id: 'u1' }, status: 'signedOut' }) }, SESSION_END_CODES: new Set() }));

const shared = { batchId: 'b1', subcategoryId: 's1', subcategoryName: 'Sub', channel: 'both' };

test('a set is one job with all its tags; every tag waiting is blocked', () => {
  const [ref] = queue.add([{ photoUri: 'file:///a.jpg', tags: ['NH1', 'NH2', 'NH3'] }], shared);
  queue.add([{ photoUri: 'file:///b.jpg', tags: ['NH4'] }], shared);
  const job = queue.getState().jobs.find((j) => j.clientRef === ref);
  expect(job.tags).toEqual(['NH1', 'NH2', 'NH3']);
  expect([...pendingTags()].sort()).toEqual(['NH1', 'NH2', 'NH3', 'NH4']);
});

test('Fix replaces only the refused tag of a set', () => {
  const [ref] = queue.add([{ photoUri: 'file:///c.jpg', tags: ['NH5', 'NH6', 'NH7'] }], shared);
  // as the worker leaves it after the server said NH6 is taken
  queue.getState().jobs.find((j) => j.clientRef === ref).error = { code: 'TAG_TAKEN', tag: 'NH6' };
  queue.fixTag(ref, 'NH9');
  const job = queue.getState().jobs.find((j) => j.clientRef === ref);
  expect(job.tags).toEqual(['NH5', 'NH9', 'NH7']);
  expect(job.status).toBe('waiting');
  expect(productsApi.createProduct).not.toHaveBeenCalled(); // signed out: nothing is sent
});

test('a job saved before sets (one `tag`) still works', () => {
  const ref = 'sr-old';
  queue.getState().jobs.push({ clientRef: ref, ownerId: 'u1', tag: 'NH8', status: 'failed', error: { code: 'TAG_TAKEN' } });
  expect(pendingTags().has('NH8')).toBe(true);
  queue.fixTag(ref, 'NH10');
  const job = queue.getState().jobs.find((j) => j.clientRef === ref);
  expect(job.tags).toEqual(['NH10']);
  expect(job.tag).toBeUndefined();
});
