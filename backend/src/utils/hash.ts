import argon2, { argon2id, type HashOptions } from 'argon2';

const ARGON2_OPTIONS: HashOptions = {
  type: argon2id,
  memoryCost: 2 ** 16,
  timeCost: 3,
  parallelism: 1,
};

/** Argon2id hash — used for both account passwords and MPINs. */
export const hashSecret = async (value: string): Promise<string> => {
  return await argon2.hash(value, ARGON2_OPTIONS);
};

export const verifySecret = async (hash: string, value: string): Promise<boolean> => {
  return await argon2.verify(hash, value);
};
