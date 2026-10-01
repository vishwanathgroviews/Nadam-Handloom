import { Request } from 'express';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { logAuthEvent } from '../auth/auditLog.service';
import { normalizeStorePhone } from './store.schema';
import type { AuthenticatedRequest } from '../../middleware/auth.middleware';

const SETTING_KEY = 'store_phone';
const DEFAULT_FALLBACK = '+917382968566';

// In-memory cache ensures zero downtime and rapid responses even before DB seeds
let cachedPhone: string | null = null;
let lastUpdatedAt: Date | null = null;

export const getStoreContact = async () => {
  try {
    const record = await (prisma as any).storeSetting?.findUnique({
      where: { key: SETTING_KEY },
    });
    if (record?.value) {
      cachedPhone = record.value;
      lastUpdatedAt = record.updatedAt ?? null;
      const normalized = normalizeStorePhone(record.value);
      return {
        ...normalized,
        updatedAt: lastUpdatedAt,
      };
    }
  } catch {
    // If table has not yet been migrated, continue with in-memory or env fallback
  }

  const phoneToUse = cachedPhone || env.COMPANY_MOBILE || DEFAULT_FALLBACK;
  const normalized = normalizeStorePhone(phoneToUse);
  return {
    ...normalized,
    updatedAt: lastUpdatedAt,
  };
};

export const updateStorePhone = async (rawPhone: string, req: AuthenticatedRequest) => {
  const normalized = normalizeStorePhone(rawPhone);

  let recordUpdatedAt = new Date();
  try {
    const saved = await (prisma as any).storeSetting?.upsert({
      where: { key: SETTING_KEY },
      update: { value: normalized.phone },
      create: { key: SETTING_KEY, value: normalized.phone },
    });
    if (saved?.updatedAt) {
      recordUpdatedAt = saved.updatedAt;
    }
  } catch {
    // Graceful fallback if database table not yet created
  }

  cachedPhone = normalized.phone;
  lastUpdatedAt = recordUpdatedAt;

  await logAuthEvent({
    authAccountId: req.user?.id || null,
    eventType: 'store_phone_updated',
    source: 'staff_app',
    req,
    metadata: {
      phone: normalized.phone,
      displayPhone: normalized.displayPhone,
    },
  });

  return {
    ...normalized,
    updatedAt: recordUpdatedAt,
  };
};
