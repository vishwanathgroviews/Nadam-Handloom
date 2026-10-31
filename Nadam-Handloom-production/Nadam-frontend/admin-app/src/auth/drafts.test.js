jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
const drafts = require('./drafts');

test('drafts survive a re-sign-in for the same person', async () => {
  await drafts.saveDraft('acc-1', 'bill', { items: 3 });
  await drafts.onSignedIn('acc-1');
  expect(await drafts.getDrafts('acc-1')).toHaveLength(1);
});

test('drafts are cleared when a different person signs in', async () => {
  await drafts.saveDraft('acc-1', 'bill', { items: 3 });
  await drafts.onSignedIn('acc-2');
  expect(await drafts.getDrafts('acc-1')).toHaveLength(0);
  expect(await drafts.getDrafts('acc-2')).toHaveLength(0);
});
