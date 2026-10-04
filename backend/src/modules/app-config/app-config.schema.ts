import { z } from 'zod';

// android.versionCode / ios.buildNumber — whole numbers, never "1.0.0".
const build = z.number().int('Enter a whole number').min(0).max(1_000_000);

const message = z.string().trim().max(300, 'Keep the message under 300 characters');

// Empty means "use the built-in store link" (see app-config.service.ts).
const updateUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === '' || /^https:\/\/\S+$/.test(value), 'Enter a link starting with https://');

const platform = z
  .object({
    latestBuild: build,
    minBuild: build,
    forceUpdate: z.boolean(),
    updateUrl,
  })
  // A minimum above the latest would demand a build that does not exist and
  // lock every phone on that platform out, with no update that could fix it.
  .refine((value) => value.minBuild <= value.latestBuild, {
    message: 'The minimum version cannot be higher than the latest version',
    path: ['minBuild'],
  });

export const updateAppConfigSchema = z.object({
  maintenance: z.object({ enabled: z.boolean(), message }),
  webMaintenance: z.object({ enabled: z.boolean(), message }),
  android: platform,
  ios: platform,
});

export type UpdateAppConfigInput = z.infer<typeof updateAppConfigSchema>;
