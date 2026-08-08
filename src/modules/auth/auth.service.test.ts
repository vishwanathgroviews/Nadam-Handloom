import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/prisma', async () => {
  const { createFakePrisma } = await import('../../test/fakePrisma');
  const fake = createFakePrisma();
  return { prisma: fake.prisma, __fake: fake };
});

describe('AuthService', () => {
  it('hashes and verifies a password round-trip', async () => {
    const { AuthService } = await import('./auth.service');
    const hash = await AuthService.hashPassword('Str0ng!Pass');
    expect(hash).not.toBe('Str0ng!Pass');
    expect(await AuthService.verifyPassword('Str0ng!Pass', hash)).toBe(true);
  });

  it('rejects an incorrect password against the stored hash', async () => {
    const { AuthService } = await import('./auth.service');
    const hash = await AuthService.hashPassword('Str0ng!Pass');
    expect(await AuthService.verifyPassword('WrongPass1!', hash)).toBe(false);
  });

  it('registerCustomer creates an AuthAccount linked to the CUSTOMER role', async () => {
    const { AuthService } = await import('./auth.service');
    const { __fake: fake }: any = await import('../../config/prisma');

    const account = await AuthService.registerCustomer({
      email: 'newcustomer@example.com',
      phone: undefined,
      password: 'Str0ng!Pass',
      firstName: 'Jane',
      lastName: 'Doe',
    });

    expect(account.email).toBe('newcustomer@example.com');
    expect(await AuthService.verifyPassword('Str0ng!Pass', account.passwordHash)).toBe(true);
    expect(fake._internal.authAccounts.get(account.id)).toBeDefined();
  });
});
