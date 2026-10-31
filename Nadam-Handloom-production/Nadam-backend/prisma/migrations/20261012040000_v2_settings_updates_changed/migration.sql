-- Module 11: before this module only the settings row's own time was saved (the old app
-- saves everything with one button, so that time is the last update-settings change, by
-- nobody recorded). Keep it as "App updates · last changed"; the row's time moves on any
-- later save (maintenance, shop details) and must not be shown as an update change.
UPDATE "AppConfig" SET "updatesChangedAt" = "updatedAt", "updatesChangedBy" = "updatedBy" WHERE "updatesChangedAt" IS NULL;
