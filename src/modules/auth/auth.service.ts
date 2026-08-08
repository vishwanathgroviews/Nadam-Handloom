import * as argon2 from 'argon2';
import { prisma } from '../../config/prisma';

// Argon2 options for enterprise-grade hashing
const hashOptions = {
  // node-argon2's .d.cts widens this constant to `number` under esModuleInterop
  // namespace-style imports; cast back to the literal union `Options.type` expects.
  type: argon2.argon2id as 0 | 1 | 2,
  memoryCost: 2 ** 16,
  timeCost: 3,
  parallelism: 1,
};

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, hashOptions);
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }

  static async registerCustomer(data: any) {
    const passwordHash = await this.hashPassword(data.password);

    // Get the CUSTOMER role ID
    const role = await prisma.role.findUnique({ where: { name: 'CUSTOMER' } });
    if (!role) throw new Error('Customer role not found in DB');

    // Run in a transaction to prevent orphaned records
    return await prisma.$transaction(async (tx) => {
      const account = await tx.authAccount.create({
        data: {
          email: data.email,
          phone: data.phone,
          passwordHash,
          roles: {
            create: { roleId: role.id }
          },
          userProfile: {
            create: {
              firstName: data.firstName,
              lastName: data.lastName
            }
          }
        },
        include: {
          userProfile: true,
          roles: { include: { role: true } }
        }
      });
      return account;
    });
  }
}
