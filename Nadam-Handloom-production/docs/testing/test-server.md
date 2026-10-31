# Team test server (new admin app v2)

Set up 2026-10-12 so the team can test the new admin app on their own phones. **Test only: it never changes the live shop.**

**Paused since 2026-10-13** (`pm2 stop nandam-v2-test`): the 1 GB server can't hold the old server, the new live server and this one together, so the team's Android test app shows a connection error for now. To bring it back, first copy the newest code and run the new database update on the test database ("Update the test server" below), check `free -m` shows room, then `pm2 start nandam-v2-test && pm2 save`.

| Part | Where |
|---|---|
| App | `Nandam-Admin-TEST-v2.0.0-build1.apk` (app id `com.nandamhandlooms.admin.test`, "Nandam Admin (Test)", ARM phones), in `~/Documents/Nandam-Handlooms/apk/` with `Nandam-Admin-TEST-guide.txt` for the team |
| Address the app uses | `https://api.nandamhandlooms.com/test/api/v2` |
| Server | The live EC2 (`15.206.40.138`), folder `/var/www/nandam-v2-test/backend`, pm2 process `nandam-v2-test`, port 4100 on 127.0.0.1 only (not reachable from the internet), memory cap 300 MB |
| Web address rule | nginx `location /test/ → 127.0.0.1:4100` in the `api.nandamhandlooms.com` block of `/etc/nginx/sites-available/nandamhandlooms`. Backup of the file before the change: `/home/ubuntu/nginx-nandamhandlooms.backup-before-v2-test-20261012` |
| Database | `nandam_v2_test` in the live Neon project (same endpoint as `neondb`, separate database), copied from live on 2026-10-12, then: the 10 v2 migrations, `copy-store-prices.js --yes`, `prepare-test-db.js 1` (customers blanked, live sign-ins removed, test logins, app settings), invoice PDFs re-made by `remake-test-invoices.js` |
| Files | S3 bucket `nandamhandlooms-media`, folder `v2-test/` only (`S3_KEY_PREFIX=v2-test`). The test server never deletes a file outside `v2-test/` (checked on the server: replacing a design photo kept the live file) |
| Mode | `NODE_ENV=development`: SMS codes shown on the phone, no SMS sent |

**Test logins:** Owner (test) 90000 00001 PIN 246810 · Staff (test) 90000 00002 PIN 135792.

## Update the test server with new code
1. On the Mac: `rsync -az --delete --exclude node_modules --exclude '.env*' --exclude uploads --exclude tests ./ ubuntu@15.206.40.138:/var/www/nandam-v2-test/backend/` (from `Nadam-backend`).
2. On the server: `cd /var/www/nandam-v2-test/backend && npm ci && npx prisma generate`, then migrations against the test database if any are new, then `pm2 restart nandam-v2-test`.
3. A new APK for the team: build with `APP_VARIANT=test EXPO_PUBLIC_API_URL=https://api.nandamhandlooms.com/test/api/v2 ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a`, raise `versionCode` in `app.config.js`, and set the test database's newest Android build to it (Settings → App updates, or `prepare-test-db.js <build>` on a fresh copy).

## Check it
`curl https://api.nandamhandlooms.com/test/api/v2/health` → `{"status":"ok","database":"ok",…}`; `pm2 ls` shows `nandam-v2-test` online; the live API (`/api/v1/app-config`) and the website still answer 200.

## Switch it off and remove it
1. `pm2 delete nandam-v2-test && pm2 save`.
2. Remove the `location /test/ { … }` block (or put the backup file back), `sudo nginx -t && sudo systemctl reload nginx`.
3. Drop the database: `DROP DATABASE nandam_v2_test;` (connected to `neondb`, never the other way round).
4. Delete the S3 folder `v2-test/`.
5. `rm -rf /var/www/nandam-v2-test`.
The live shop is untouched by all of this.
