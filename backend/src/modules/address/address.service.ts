import { prisma } from '../../config/prisma';
import { ForbiddenError, NotFoundError } from '../../utils/errors';

export const listAddresses = async (authAccountId: string) => {
  return prisma.address.findMany({
    where: { authAccountId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
};

const ensureOwnership = async (authAccountId: string, addressId: string) => {
  const address = await prisma.address.findUnique({ where: { id: addressId } });
  if (!address) throw new NotFoundError('Address not found');
  if (address.authAccountId !== authAccountId) throw new ForbiddenError();
  return address;
};

export const createAddress = async (authAccountId: string, data: any) => {
  if (data.isDefault) {
    await prisma.address.updateMany({ where: { authAccountId, isDefault: true }, data: { isDefault: false } });
  } else {
    const existing = await prisma.address.count({ where: { authAccountId } });
    if (existing === 0) data.isDefault = true;
  }
  return prisma.address.create({ data: { ...data, authAccountId } });
};

export const updateAddress = async (authAccountId: string, addressId: string, data: any) => {
  await ensureOwnership(authAccountId, addressId);
  if (data.isDefault) {
    await prisma.address.updateMany({ where: { authAccountId, isDefault: true }, data: { isDefault: false } });
  }
  return prisma.address.update({ where: { id: addressId }, data });
};

export const deleteAddress = async (authAccountId: string, addressId: string) => {
  await ensureOwnership(authAccountId, addressId);
  await prisma.address.delete({ where: { id: addressId } });
};
