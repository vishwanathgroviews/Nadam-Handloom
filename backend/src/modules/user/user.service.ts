import { prisma } from '../../config/prisma';
import { NotFoundError } from '../../utils/errors';

export class UserService {
  async getProfile(userId: string) {
    const user = await prisma.authAccount.findUnique({
      where: { id: userId },
      include: {
        userProfile: true,
        roles: { include: { role: true } }
      }
    });

    if (!user) throw new NotFoundError('User not found');

    const { passwordHash, mpinHash, securityStamp, ...safeUser } = user;
    return safeUser;
  }

  // Staff/admin app Profile screen — deliberately separate from getProfile
  // above (customer-facing, reads/writes UserProfile) since admin/staff
  // accounts have an AdminProfile instead and no writable fields here yet.
  async getStaffProfile(userId: string) {
    const user = await prisma.authAccount.findUnique({
      where: { id: userId },
      include: {
        adminProfile: true,
        roles: { include: { role: true } },
      },
    });

    if (!user) throw new NotFoundError('User not found');

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      roles: user.roles.map((r) => r.role.name),
      name: user.adminProfile ? `${user.adminProfile.firstName} ${user.adminProfile.lastName}`.trim() : null,
      employeeId: user.adminProfile?.employeeId ?? null,
      department: user.adminProfile?.department ?? null,
      jobTitle: user.adminProfile?.jobTitle ?? null,
    };
  }

  async updateProfile(userId: string, data: any) {
    const userProfile = await prisma.userProfile.update({
      where: { authAccountId: userId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
        preferences: data.preferences
      }
    });

    return userProfile;
  }
}
