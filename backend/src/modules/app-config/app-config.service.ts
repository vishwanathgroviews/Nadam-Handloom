import { Request } from 'express';
import { prisma } from '../../config/prisma';
import { logAuthEvent } from '../auth/auditLog.service';
import { UpdateAppConfigInput } from './app-config.schema';

/**
 * What the staff app and the storefront read every time they open, to decide
 * whether to show the normal app, a maintenance screen, or an update prompt.
 *
 * The decision itself is made by the clients (they know their own build
 * number); the server only stores the switches. Nothing here blocks an API
 * call — a build that predates the check, or a client that ignores it, keeps
 * working.
 */

const CONFIG_ID = 'default';

// Used until an admin saves a link of their own.
const DEFAULT_UPDATE_URLS = {
  android: 'https://play.google.com/store/apps/details?id=com.nandamhandlooms.staff',
  // The iPhone app is distributed through TestFlight, not the App Store;
  // this opens its page there.
  ios: 'https://beta.itunes.apple.com/v1/app/6818412372',
};

export interface PlatformUpdateConfig {
  latestBuild: number;
  minBuild: number;
  forceUpdate: boolean;
  updateUrl: string;
}

export interface AppConfigView {
  maintenance: { enabled: boolean; message: string };
  webMaintenance: { enabled: boolean; message: string };
  android: PlatformUpdateConfig;
  ios: PlatformUpdateConfig;
  updatedAt: Date | null;
}

type AppConfigRow = NonNullable<Awaited<ReturnType<typeof prisma.appConfig.findUnique>>>;

// Before anything has been saved there is no row: everything is off and no
// build is required, which is exactly how the app behaved before this existed.
const toView = (row: AppConfigRow | null): AppConfigView => ({
  maintenance: { enabled: row?.maintenanceEnabled ?? false, message: row?.maintenanceMessage ?? '' },
  webMaintenance: { enabled: row?.webMaintenanceEnabled ?? false, message: row?.webMaintenanceMessage ?? '' },
  android: {
    latestBuild: row?.androidLatestBuild ?? 0,
    minBuild: row?.androidMinBuild ?? 0,
    forceUpdate: row?.androidForceUpdate ?? false,
    updateUrl: row?.androidUpdateUrl || DEFAULT_UPDATE_URLS.android,
  },
  ios: {
    latestBuild: row?.iosLatestBuild ?? 0,
    minBuild: row?.iosMinBuild ?? 0,
    forceUpdate: row?.iosForceUpdate ?? false,
    updateUrl: row?.iosUpdateUrl || DEFAULT_UPDATE_URLS.ios,
  },
  updatedAt: row?.updatedAt ?? null,
});

const toColumns = (data: UpdateAppConfigInput) => ({
  maintenanceEnabled: data.maintenance.enabled,
  maintenanceMessage: data.maintenance.message,
  webMaintenanceEnabled: data.webMaintenance.enabled,
  webMaintenanceMessage: data.webMaintenance.message,
  androidLatestBuild: data.android.latestBuild,
  androidMinBuild: data.android.minBuild,
  androidForceUpdate: data.android.forceUpdate,
  androidUpdateUrl: data.android.updateUrl,
  iosLatestBuild: data.ios.latestBuild,
  iosMinBuild: data.ios.minBuild,
  iosForceUpdate: data.ios.forceUpdate,
  iosUpdateUrl: data.ios.updateUrl,
});

export const getAppConfig = async (): Promise<AppConfigView> => {
  try {
    return toView(await prisma.appConfig.findUnique({ where: { id: CONFIG_ID } }));
  } catch {
    return toView(null);
  }
};

export const updateAppConfig = async (
  data: UpdateAppConfigInput,
  actorId: string,
  req: Request
): Promise<AppConfigView> => {
  const columns = toColumns(data);
  const before = await prisma.appConfig.findUnique({ where: { id: CONFIG_ID } });

  const row = await prisma.appConfig.upsert({
    where: { id: CONFIG_ID },
    update: { ...columns, updatedBy: actorId },
    create: { id: CONFIG_ID, ...columns, updatedBy: actorId },
  });

  // These switches can lock every phone in the shop out, so the Audit Log
  // records exactly what was changed, from what to what.
  const previous: Record<string, unknown> = before ?? toColumns(toView(null));
  const changes = Object.fromEntries(
    Object.entries(columns)
      .filter(([key, value]) => previous[key] !== value)
      .map(([key, value]) => [key, { from: previous[key], to: value }])
  );
  await logAuthEvent({
    authAccountId: actorId,
    eventType: 'app_config_updated',
    source: 'staff_app',
    req,
    metadata: { changes },
  });

  return toView(row);
};
