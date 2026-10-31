// The permission check reads the list the server sent; nothing is assumed from the role.
jest.mock('./session', () => ({ useSession: jest.fn() }));
const { can, PERMISSION } = require('./permissions');

test('allowed only when the server listed it', () => {
  const staff = { role: 'staff', permissions: ['catalog.view', 'products.manage', 'orders.manage', 'sell.use'] };
  expect(can(staff, PERMISSION.PRODUCTS_MANAGE)).toBe(true);
  expect(can(staff, PERMISSION.TEAM_MANAGE)).toBe(false);
  expect(can(staff, PERMISSION.SALES_VIEW)).toBe(false);
  expect(can({ role: 'owner' }, PERMISSION.TEAM_MANAGE)).toBe(false); // no list, no access
  expect(can(null, PERMISSION.SELL_USE)).toBe(false);
});
