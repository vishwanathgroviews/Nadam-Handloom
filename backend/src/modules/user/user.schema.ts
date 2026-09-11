import { z } from 'zod';

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  displayName: z.string().trim().max(150).optional(),
  avatarUrl: z.string().trim().url().max(2000).optional(),
  preferences: z.record(z.string(), z.unknown()).optional(),
});
