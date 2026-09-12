# Nandam Handlooms — Complete Deployment Runbook

**Goal:** live website at `https://nandamhandlooms.com`, live API, live database, and a signed Android APK of the staff app that talks to the live API — shared with the client.

**Read this first:**

- Follow the parts **in order**. Each part depends on the one before it.
- Commands marked `[PC]` you type on **your Windows machine** in PowerShell.
- Commands marked `[SERVER]` you type on the **EC2 server**, after you SSH in.
- Anywhere you see `<SOMETHING>` you must replace it with your real value.
- Keep a text file open called `deployment-notes.txt` and paste every password, key, and IP address into it as you go. You will need them again.

**Architecture you are building:**

```
                        Internet
                           |
            +--------------+---------------+
            |                              |
   nandamhandlooms.com            api.nandamhandlooms.com
   www.nandamhandlooms.com                 |
            |                              |
            +--------------+---------------+
                           |
                  [ AWS EC2 - Ubuntu ]
                           |
                       [ Nginx ]   <- terminates HTTPS on port 443
                        /      \
                       /        \
          static React site      proxy to 127.0.0.1:4000
          (customer-web)               |
                               [ Node backend, kept alive by PM2 ]
                                       |
                       +---------------+---------------+
                       |                               |
                [ Neon Postgres ]              [ S3 bucket ]
                (database)                     nandamhandlooms-media
                                               (images, invoices, PDFs)

   [ Staff APK on phones ] ------> https://api.nandamhandlooms.com
```

---

## PART 0 — Before you start

### 0.1 Accounts you need

Tick each one off. Do not start Part 1 until all of these exist.

| # | Account | Why | Where |
|---|---------|-----|-------|
| 1 | AWS account with billing set up | EC2 server, S3 | https://aws.amazon.com |
| 2 | Domain registrar login for `nandamhandlooms.com` | To point the domain at your server | Wherever you bought it |
| 3 | Neon account | Database | https://neon.tech |
| 4 | Razorpay account, **KYC approved**, Live Mode on | Real payments | https://dashboard.razorpay.com |
| 5 | MSG91 account with an approved DLT SMS template | OTP for customer signup and staff activation | https://msg91.com |
| 6 | Expo account | Building the APK | https://expo.dev |
| 7 | GitHub access to `vishwanathgroviews/Nadam-Handloom` | Getting code onto the server | https://github.com |

### 0.2 Three things that will block you if you ignore them now

**(a) Your SMS provider is set to `console`.**

Right now `SMS_PROVIDER="console"` in your `.env`. That prints OTPs to the server log instead of sending an SMS, and in production the code deliberately stops echoing the OTP back in the API response. **Result: nobody — not a customer, not a new staff member — can complete signup.** You need real MSG91 credentials (Part 13). Getting a DLT template approved in India takes **2 to 5 working days**. Start that application today, before anything else in this document.

**(b) Razorpay live keys need KYC.**

Your `.env` has test keys. Live keys only appear after Razorpay approves your business KYC. This also takes days. Start it today.

**(c) You have uncommitted code changes.**

`git status` currently shows modified and deleted files. The server pulls code from GitHub, so anything not pushed will not be deployed. Part 1 handles this.

### 0.3 What this will cost per month

| Item | Cost |
|------|------|
| EC2 `t3.small` on-demand | ~₹1,500 |
| EBS storage, 30 GB | ~₹250 |
| Elastic IP (free while attached to a running instance) | ₹0 |
| Data transfer out, small shop traffic | ~₹100–300 |
| Neon (free tier, or Launch plan) | ₹0 – ₹1,700 |
| S3 storage and requests | ~₹50–150 |
| EAS Build free tier | ₹0 |
| **Total** | **~₹1,900 – ₹4,000 / month** |

`t3.micro` (~₹750/mo) works but image uploads and PDF generation will be visibly slow. `t3.small` is the sensible floor.

---

## PART 1 — Prepare your code and push it to GitHub

Everything in this part runs on your **Windows PC**.

### Step 1.1 — Open PowerShell in the project

```powershell
cd D:\Handlooms\Nadam-Handloom
```

### Step 1.2 — See what is uncommitted

```powershell
git status
```

You will see files marked `M` (modified) and `D` (deleted). These are real changes that are not yet on GitHub.

### Step 1.3 — Make sure no secrets are about to be committed

```powershell
git check-ignore -v backend\.env
```

This must print a line confirming `.env` is ignored. **If it prints nothing, stop.** Your database password would get pushed to GitHub. Fix `.gitignore` before continuing.

### Step 1.4 — Run the tests before you deploy

```powershell
cd backend
npm test
```

If tests fail, fix them now. Deploying code you already know is broken makes it impossible later to tell whether a bug came from the code or from the server setup.

### Step 1.5 — Confirm the backend compiles

```powershell
npm run build
```

Must finish with no errors and produce a `dist` folder. Any TypeScript error here will also happen on the server.

### Step 1.6 — Confirm the website builds

```powershell
cd ..\frontend\customer-web
npm run build
```

Must finish and produce a `dist` folder.

### Step 1.7 — Commit and push

```powershell
cd D:\Handlooms\Nadam-Handloom
git add -A
git commit -m "Prepare for production deployment"
git push origin main
```

If `git push` asks for a password, GitHub no longer accepts account passwords. Create a Personal Access Token:

1. https://github.com/settings/tokens → **Generate new token (classic)**
2. Note: `deploy`, Expiration: `90 days`, Scope: tick **`repo`**
3. **Generate token**, then **copy it immediately** — you can never view it again
4. Paste it into `deployment-notes.txt` as `GITHUB_TOKEN`
5. Use that token as the password when git prompts

### Step 1.8 — Verify it landed

Open https://github.com/vishwanathgroviews/Nadam-Handloom in a browser. The newest commit should say "Prepare for production deployment" with today's date.

**Do not continue until you see that.**

---

## PART 2 — Production database (Neon)

You currently develop against a single Neon database. If the live shop uses that same database, one mistake during development — a wrong migration, a test order, a deleted product — hits real customer data instantly. So you will create a separate **production branch**. Neon copies your current data into it in seconds, and from then on the two are independent.

### Step 2.1 — Log in to Neon

https://console.neon.tech

### Step 2.2 — Check your region, and decide where EC2 goes

Open your project. The **Dashboard** shows the region — currently `AWS ap-southeast-1 (Singapore)`.

This matters. One page load on your site makes several database queries. If the server is in Mumbai and the database in Singapore, every one of those queries pays a ~50 ms round trip. Same region means ~2 ms.

Click **New Project** and look at the region dropdown (you can cancel afterwards):

- **If `AWS ap-south-1 (Mumbai)` is in the list** → create a new Neon project there. Your EC2 goes in Mumbai too. You will move your data across in Step 2.6.
- **If Mumbai is not in the list** → use the branch approach in Step 2.3, and launch your EC2 in **Singapore (`ap-southeast-1`)** in Part 4 instead of Mumbai.

Write your choice in `deployment-notes.txt` as `EC2_REGION`. Part 4 depends on it.

> Your S3 bucket stays in Mumbai either way. That is fine — customer browsers load images straight from S3, they do not pass through your server.

### Step 2.3 — Create the production branch

1. Left sidebar → **Branches**
2. **Create branch**
3. Name: `production`
4. Parent branch: `main` (or whatever yours is called)
5. Include data: **Yes / Head** — this copies all existing products and categories
6. **Create branch**

### Step 2.4 — Get the two connection strings

Inside the `production` branch:

1. Click **Connect** (or **Connection Details**)
2. Branch dropdown must say `production`, Database `neondb`
3. Find the **Connection pooling** toggle:
   - **Pooling ON** → this string is your `DATABASE_URL`
   - **Pooling OFF** → this string is your `DIRECT_URL`

The pooled one has `-pooler` in the hostname; the direct one does not:

```
DATABASE_URL = postgresql://neondb_owner:XXXX@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require&channel_binding=require
DIRECT_URL   = postgresql://neondb_owner:XXXX@ep-xxxx.REGION.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

Your app needs both: the pooled one for normal traffic, the direct one because database migrations cannot run through a pooler.

Paste both into `deployment-notes.txt` under `PRODUCTION DATABASE`.

### Step 2.5 — Turn on history retention

Neon → **Settings → Storage / History retention**. Set the restore window to the maximum your plan allows (7 days free, 30 days paid). This is your undo button if someone deletes the wrong thing.

### Step 2.6 — Move data (only if you created a fresh Mumbai project)

Skip this entirely if you branched in Step 2.3.

You need PostgreSQL command-line tools. Install from https://www.postgresql.org/download/windows/ — during setup you only need the **Command Line Tools** component.

```powershell
# [PC]
pg_dump "<OLD_DIRECT_URL>" -Fc -f handloom-backup.dump
pg_restore -d "<NEW_DIRECT_URL>" --no-owner --no-privileges handloom-backup.dump
```

Keep `handloom-backup.dump` somewhere safe. It is a full copy of your data.

### Step 2.7 — Generate your production JWT secrets

These sign every login token. They must be different from your development ones and different from each other. Run this **twice** in PowerShell:

```powershell
# [PC]
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Record both values in `deployment-notes.txt`:

```
JWT_ACCESS_SECRET  = <first value>
JWT_REFRESH_SECRET = <second value>
```

### Step 2.8 — Choose your production price code word

Your staff app prints coded prices on product tags using a 10-letter word, where each letter maps to a digit 0–9. The default is `BLACKHORSE`, which is written in your public source code — so anyone could decode a printed price tag.

Pick your own word: exactly **10 letters, none repeating**. Valid examples: `BRIGHTCLAW`, `CHARMBOLTS`, `DUSTPANFLY`.

Count the letters and check for duplicates, then record it as `PRICE_CODE_WORD`.

---

## PART 3 — S3 bucket and server permissions

Your product images, invoices and catalog PDFs live in the S3 bucket `nandamhandlooms-media` in Mumbai. On your laptop the AWS SDK finds credentials at `C:\Users\goran\.aws\credentials`. A fresh server has no such file.

You could copy secret keys onto the server, but you will not. Instead you attach an **IAM role** to the EC2 instance. AWS then hands short-lived credentials to the server automatically and rotates them — nothing secret is ever written to disk. Your code already supports this: it uses explicit keys if present, and otherwise falls back to the AWS credential chain, which reads the instance role.

### Step 3.1 — Confirm the bucket serves images publicly

1. https://console.aws.amazon.com/s3
2. Region selector (top right) → **Asia Pacific (Mumbai) ap-south-1**
3. Click `nandamhandlooms-media`
4. In a new browser tab, open:
   `https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/site/brand/logo.png`

If the logo displays, move to Step 3.2.

If you get **AccessDenied**, every image on your site will be broken. Fix it:

- Bucket → **Permissions** tab → **Block public access (bucket settings)** → **Edit** → untick **Block all public access** → **Save changes** → type `confirm`
- Still in **Permissions** → **Bucket policy** → **Edit** → paste this → **Save changes**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadForSiteMedia",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::nandamhandlooms-media/*"
    }
  ]
}
```

Reload the logo URL. It must display now.

### Step 3.2 — Create the IAM policy

1. https://console.aws.amazon.com/iam
2. Left sidebar → **Policies** → **Create policy**
3. Click the **JSON** tab, clear it, paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "HandloomMediaObjects",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::nandamhandlooms-media/*"
    },
    {
      "Sid": "HandloomMediaBucket",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::nandamhandlooms-media"
    }
  ]
}
```

4. **Next** → Policy name: `NandamHandloomsMediaAccess` → **Create policy**

### Step 3.3 — Create the IAM role for EC2

1. IAM → **Roles** → **Create role**
2. Trusted entity type: **AWS service**
3. Use case: **EC2** → **Next**
4. Search `NandamHandloomsMediaAccess`, tick it → **Next**
5. Role name: `NandamHandloomsServerRole` → **Create role**

You attach this to the server in Part 4.

---

## PART 4 — Launch the EC2 server

### Step 4.1 — Pick your region

Top-right region selector in the AWS console. Choose the region you recorded as `EC2_REGION` in Step 2.2 — **Mumbai `ap-south-1`** or **Singapore `ap-southeast-1`**.

Everything from here on must be created in that same region. If you ever "lose" a resource in AWS, the cause is almost always that you are looking at the wrong region.

### Step 4.2 — Create a key pair (your SSH password, as a file)

1. EC2 console → left sidebar → **Network & Security → Key Pairs**
2. **Create key pair**
3. Name: `nandam-handlooms-key`
4. Key pair type: **RSA**
5. Private key file format: **.pem**
6. **Create key pair** — the browser downloads `nandam-handlooms-key.pem`

**This file is the only way into your server. If you lose it, you cannot get back in.** Move it somewhere permanent:

```powershell
# [PC]
New-Item -ItemType Directory -Force "$env:USERPROFILE\.ssh"
Move-Item "$env:USERPROFILE\Downloads\nandam-handlooms-key.pem" "$env:USERPROFILE\.ssh\nandam-handlooms-key.pem"
```

Now lock down its permissions — Windows gives new files broad access, and SSH refuses to use a key that other accounts can read:

```powershell
# [PC]
$key = "$env:USERPROFILE\.ssh\nandam-handlooms-key.pem"
icacls $key /inheritance:r
icacls $key /grant:r "$($env:USERNAME):(R)"
```

### Step 4.3 — Launch the instance

EC2 console → **Instances** → **Launch instances**

| Field | Value |
|-------|-------|
| Name | `nandam-handlooms-prod` |
| Application and OS Image | **Ubuntu Server 24.04 LTS (HVM), SSD Volume Type**, 64-bit (x86) |
| Instance type | **t3.small** |
| Key pair | `nandam-handlooms-key` |

**Network settings** — click **Edit**:

| Field | Value |
|-------|-------|
| VPC | leave default |
| Auto-assign public IP | **Enable** |
| Firewall (security groups) | **Create security group** |
| Security group name | `nandam-handlooms-sg` |
| Description | `Web and SSH for Nandam Handlooms` |

Add exactly three inbound rules:

| Type | Port | Source | Why |
|------|------|--------|-----|
| SSH | 22 | **My IP** | So only you can log in |
| HTTP | 80 | Anywhere `0.0.0.0/0` | Visitors, and Let's Encrypt certificate checks |
| HTTPS | 443 | Anywhere `0.0.0.0/0` | The real site |

> Never open port 4000 or 22-to-anywhere. Nginx is the only thing the internet talks to; the Node backend listens on `127.0.0.1` only.

**Configure storage:** change `8 GiB` to **`30` GiB**, type **gp3**. Node modules, build output and logs fill 8 GB quickly, and a full disk takes the site down in a way that is confusing to diagnose.

**Advanced details** — scroll down to **IAM instance profile** → select **`NandamHandloomsServerRole`**. This is the step people forget; without it your image uploads will fail with a credentials error.

Click **Launch instance**.

### Step 4.4 — Give it a permanent IP (Elastic IP)

A default EC2 public IP changes every time the instance restarts. Your domain would then point at nothing. An Elastic IP is fixed.

1. EC2 → **Network & Security → Elastic IPs**
2. **Allocate Elastic IP address** → **Allocate**
3. Select the new address → **Actions → Associate Elastic IP address**
4. Resource type: **Instance**, Instance: `nandam-handlooms-prod`
5. **Associate**

Copy the IP (looks like `13.234.56.78`) into `deployment-notes.txt` as `SERVER_IP`.

> Note: an Elastic IP is free only while attached to a **running** instance. If you stop the instance for a week, AWS bills a small hourly charge for the idle address.

---

## PART 5 — Connect to the server

### Step 5.1 — SSH in

```powershell
# [PC]
ssh -i "$env:USERPROFILE\.ssh\nandam-handlooms-key.pem" ubuntu@<SERVER_IP>
```

First time it asks:

```
The authenticity of host '...' can't be established.
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```

Type `yes` and press Enter.

You are in when the prompt changes to something like `ubuntu@ip-172-31-x-x:~$`.

**If it hangs and times out:** your security group SSH rule points at an old IP. Home internet IPs change. Go to EC2 → Security Groups → `nandam-handlooms-sg` → Inbound rules → Edit → set the SSH source to **My IP** again → Save.

**If it says "UNPROTECTED PRIVATE KEY FILE":** re-run the `icacls` commands from Step 4.2.

### Step 5.2 — Keep this window open

Every command marked `[SERVER]` from here on goes in this window. If you get disconnected, just run the same `ssh` command again.

---

## PART 6 — Base server setup

All `[SERVER]`.

### Step 6.1 — Update the system

```bash
sudo apt update && sudo apt upgrade -y
```

Takes 2–5 minutes. If a purple screen appears asking about restarting services, press **Tab** to highlight `<Ok>` and press Enter. If asked about a modified config file, keep the **local version** (the default choice).

### Step 6.2 — Add swap space

Your instance has 2 GB of RAM. `npm install` and the Vite website build both spike above that and get killed by the kernel with a confusing `Killed` message and no explanation. Swap is disk space used as overflow memory — it prevents that.

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Verify:

```bash
free -h
```

The `Swap:` row should show `2.0Gi`.

### Step 6.3 — Install Node.js 24

Ubuntu's own repository ships an old Node. Use NodeSource to match the version you develop on.

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify:

```bash
node -v    # should print v24.x.x
npm -v
```

### Step 6.4 — Install the rest of the tools

```bash
sudo apt install -y git nginx build-essential
```

- `git` — pulls your code
- `nginx` — the web server that handles HTTPS and routes traffic
- `build-essential` — C compiler, needed because the `argon2` password-hashing package compiles native code during install

### Step 6.5 — Confirm Nginx is alive

```bash
sudo systemctl status nginx
```

Look for `active (running)` in green. Press `q` to exit.

Now open `http://<SERVER_IP>` in your browser. You should see the **"Welcome to nginx!"** page. If you do, your security group and networking are correct — a good checkpoint before anything harder.

### Step 6.6 — Install PM2

PM2 keeps your Node backend running: it restarts it if it crashes, and starts it again automatically when the server reboots.

```bash
sudo npm install -g pm2
```

### Step 6.7 — Create the folders

```bash
sudo mkdir -p /var/www/nandamhandlooms
sudo chown -R ubuntu:ubuntu /var/www/nandamhandlooms
```

---

## PART 7 — Deploy the backend

All `[SERVER]`.

### Step 7.1 — Clone the repository

```bash
cd /var/www/nandamhandlooms
git clone https://github.com/vishwanathgroviews/Nadam-Handloom.git app
```

If the repo is **private**, git will ask for a username and password. Username is your GitHub username; password is the **Personal Access Token** from Step 1.7 — not your GitHub password.

To avoid retyping it on every deploy:

```bash
git config --global credential.helper store
```

Then the next `git pull` that asks for the token will remember it. (It is stored in plain text in `~/.git-credentials` — acceptable on a server only you can access.)

### Step 7.2 — Install backend dependencies

```bash
cd /var/www/nandamhandlooms/app/backend
npm ci --omit=dev
```

`npm ci` installs exactly the versions in `package-lock.json` — same as your PC, no surprises. `--omit=dev` skips test tooling you do not need in production.

This takes a few minutes; `argon2` compiles from source.

> If it fails with `Cannot find module` errors later, re-run without the flag: `npm ci`. Some build tooling is needed for the Prisma steps.

### Step 7.3 — Create the production environment file

```bash
nano /var/www/nandamhandlooms/app/backend/.env
```

Paste the block below, then replace every `<...>` from your `deployment-notes.txt`:

```
NODE_ENV=production
PORT=4000

DATABASE_URL="<PRODUCTION DATABASE_URL, the one with -pooler>"
DIRECT_URL="<PRODUCTION DIRECT_URL, the one without -pooler>"

JWT_ACCESS_SECRET="<JWT_ACCESS_SECRET>"
JWT_REFRESH_SECRET="<JWT_REFRESH_SECRET>"
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=1d

FRONTEND_URL="https://nandamhandlooms.com"
CORS_ALLOWED_ORIGINS="https://www.nandamhandlooms.com"

STORAGE_PROVIDER=s3
S3_BUCKET_NAME=nandamhandlooms-media
S3_REGION=ap-south-1

SMS_PROVIDER=console

RAZORPAY_KEY_ID=""
RAZORPAY_KEY_SECRET=""
RAZORPAY_WEBHOOK_SECRET=""

PRICE_CODE_WORD=<YOUR 10-LETTER WORD>

SEED_ADMIN_NAME="Nandam Admin"
SEED_ADMIN_EMAIL="<owner email>"
SEED_ADMIN_MOBILE="<owner 10-digit mobile>"
SEED_ADMIN_MPIN="<6-digit mpin you will change later>"
```

Notes on what you just pasted:

- **No `S3_ACCESS_KEY_ID`.** Deliberate — leaving those out makes the SDK use the IAM role from Part 3.
- **`SMS_PROVIDER=console` and empty Razorpay keys for now.** The server will start and the site will work; checkout returns an error and OTPs go to the log. You fill these in at Parts 12 and 13 once your approvals come through. This lets you get the site live today instead of waiting a week.
- **`PORT=4000` and no public exposure.** Nginx is the only thing the internet reaches.

Save in nano: **Ctrl+O**, Enter, then **Ctrl+X**.

Lock the file down so only your user can read it:

```bash
chmod 600 /var/www/nandamhandlooms/app/backend/.env
```

### Step 7.4 — Generate the Prisma client

```bash
cd /var/www/nandamhandlooms/app/backend
npx prisma generate
```

### Step 7.5 — Apply database migrations

```bash
npx prisma migrate deploy
```

This creates all 18 tables in your production database. `migrate deploy` only applies existing migration files — unlike `migrate dev` it will never try to modify your schema or wipe data. It is the correct command for production.

You should see a list of applied migrations ending with `All migrations have been successfully applied`.

**If it errors with "database is not empty" or "migrations already applied":** that is expected and fine if you branched from an existing database in Step 2.3 — the migration history came across with the data.

### Step 7.6 — Seed roles, permissions and the admin account

```bash
npx prisma db seed
```

This creates the `ADMIN` / `STAFF` / `CUSTOMER` roles, the permission rows, and the first admin login using your `SEED_ADMIN_*` values. Without this there is no way to log into the staff app at all.

It is safe to run more than once — it uses upserts.

### Step 7.7 — Build the backend

```bash
npm run build
```

Compiles TypeScript into `dist/`. Must finish with no errors.

### Step 7.8 — Start it with PM2

```bash
pm2 start dist/index.js --name nandam-api
```

Check it came up:

```bash
pm2 logs nandam-api --lines 40
```

You are looking for:

```
Successfully connected to the database
  storage:  s3 — bucket "nandamhandlooms-media" (ap-south-1). Falling back to the AWS SDK credential chain...
  payments: razorpay — NOT configured...
Server is running on port 4000
```

The storage line mentioning the credential chain is **correct** — that is the IAM role working. The Razorpay line is expected for now.

Press **Ctrl+C** to stop watching logs (this does not stop the server).

### Step 7.9 — Test the API locally on the server

```bash
curl http://127.0.0.1:4000/health
```

Expected: `{"status":"ok","timestamp":"..."}`

**If you get "connection refused",** the process crashed. Run `pm2 logs nandam-api --lines 100` and read the error. The most common causes are a typo in `DATABASE_URL` or a missing quote in `.env`.

### Step 7.10 — Make PM2 survive reboots

```bash
pm2 save
pm2 startup
```

`pm2 startup` prints one long command beginning with `sudo env PATH=...`. **Copy that exact line, paste it, and run it.** Without this step your site goes down permanently the next time AWS restarts the instance.

Verify:

```bash
pm2 list
```

`nandam-api` should show status `online`.

---

## PART 8 — Build and deploy the website

All `[SERVER]`.

### Step 8.1 — Install website dependencies

```bash
cd /var/www/nandamhandlooms/app/frontend/customer-web
npm ci
```

Here you need dev dependencies (Vite is one), so no `--omit=dev`.

### Step 8.2 — Build the site

```bash
npm run build
```

This produces a `dist` folder of plain HTML, CSS and JavaScript — no Node process needed to serve it.

Note what you are **not** setting: `VITE_API_URL` stays unset on purpose. Unset means the site calls a relative `/api/v1`, on whatever domain the browser loaded it from. Nginx will forward that to your backend. That keeps the site and API on one origin, which means **no CORS configuration to get wrong, and login cookies work without any special handling.**

Takes 1–3 minutes. If it gets `Killed`, your swap from Step 6.2 is missing — go back and add it.

### Step 8.3 — Confirm the build output exists

```bash
ls -la dist
```

You should see `index.html` and an `assets` folder.

---

## PART 9 — Configure Nginx

All `[SERVER]`.

### Step 9.1 — Remove the default site

```bash
sudo rm /etc/nginx/sites-enabled/default
```

### Step 9.2 — Create your site configuration

```bash
sudo nano /etc/nginx/sites-available/nandamhandlooms
```

Paste this exactly:

```nginx
# ── Customer website + same-origin API ────────────────────────────────
server {
    listen 80;
    listen [::]:80;
    server_name nandamhandlooms.com www.nandamhandlooms.com;

    root /var/www/nandamhandlooms/app/frontend/customer-web/dist;
    index index.html;

    # Product photos are uploaded through the API; 1 MB (the nginx default)
    # is far too small and fails with a confusing 413.
    client_max_body_size 25m;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    # API calls from the website go to the Node backend.
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # Catalog PDF generation can take a while on a small instance.
        proxy_read_timeout 120s;
    }

    # Hashed build assets never change content, so cache them hard.
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # React Router handles the URLs, not nginx. Any unknown path must still
    # return index.html, or refreshing on /products/xyz gives a 404.
    location / {
        try_files $uri $uri/ /index.html;
    }
}

# ── API subdomain, used by the staff APK ──────────────────────────────
server {
    listen 80;
    listen [::]:80;
    server_name api.nandamhandlooms.com;

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

Save: **Ctrl+O**, Enter, **Ctrl+X**.

### Step 9.3 — Enable it and check the syntax

```bash
sudo ln -s /etc/nginx/sites-available/nandamhandlooms /etc/nginx/sites-enabled/
sudo nginx -t
```

`nginx -t` must print:

```
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

If it reports an error, it tells you the line number. Reopen the file and fix it. **Never reload nginx after a failed test** — you will take the server down.

### Step 9.4 — Reload

```bash
sudo systemctl reload nginx
```

### Step 9.5 — Test by IP before touching DNS

```bash
curl -I http://127.0.0.1 -H "Host: nandamhandlooms.com"
curl http://127.0.0.1/api/v1/catalog/categories -H "Host: nandamhandlooms.com"
curl http://127.0.0.1/health -H "Host: api.nandamhandlooms.com"
```

Expected: a `200 OK` for the first, a JSON list of categories for the second, and `{"status":"ok"...}` for the third.

This confirms nginx routing works **before** DNS is involved, so if something breaks in Part 10 you know it is DNS and not your server.

---

## PART 10 — Point nandamhandlooms.com at the server

### Step 10.1 — Log in to your domain registrar

Wherever you bought `nandamhandlooms.com` — GoDaddy, Hostinger, BigRock, Namecheap. Find the section called **DNS Management**, **DNS Records**, or **Manage DNS**.

### Step 10.2 — Delete conflicting records

Registrars often pre-fill a parking page. **Delete any existing `A` or `CNAME` record** whose Name/Host is `@`, `www`, or `api`. Leave `MX` (email) and `TXT` records alone.

### Step 10.3 — Add three A records

| Type | Name / Host | Value / Points to | TTL |
|------|-------------|-------------------|-----|
| A | `@` | `<SERVER_IP>` | 3600 (or Automatic) |
| A | `www` | `<SERVER_IP>` | 3600 |
| A | `api` | `<SERVER_IP>` | 3600 |

Some registrars want the full name instead of `@` — in that case enter `nandamhandlooms.com`, `www.nandamhandlooms.com`, `api.nandamhandlooms.com`.

Save.

### Step 10.4 — Wait, then verify

DNS changes take anywhere from 5 minutes to a few hours. Check from your PC:

```powershell
# [PC]
nslookup nandamhandlooms.com
nslookup www.nandamhandlooms.com
nslookup api.nandamhandlooms.com
```

Each must return your `<SERVER_IP>`. If it returns something else or "can't find", wait longer and try again. You can also check globally at https://dnschecker.org.

**Do not go to Part 11 until all three resolve correctly.** Let's Encrypt verifies your domain over HTTP, and it will fail if DNS is not ready — and it rate-limits you to 5 failures per hour.

### Step 10.5 — Open the site over plain HTTP

Visit `http://nandamhandlooms.com` in your browser. Your site should load (with a "Not secure" warning — that is expected, HTTPS comes next).

---

## PART 11 — HTTPS with a free SSL certificate

All `[SERVER]`.

### Step 11.1 — Install Certbot

```bash
sudo snap install core
sudo snap refresh core
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
```

The snap version is used instead of the apt one because it self-updates, which matters for a tool whose job is renewing certificates for years.

### Step 11.2 — Get certificates for all three names at once

```bash
sudo certbot --nginx -d nandamhandlooms.com -d www.nandamhandlooms.com -d api.nandamhandlooms.com
```

It asks:

1. **Email address** — use a real one; Let's Encrypt emails you if a renewal fails
2. **Terms of Service** — type `Y`
3. **Share email with EFF** — `N` is fine
4. **Redirect HTTP to HTTPS?** — choose **`2` (Redirect)**. This means anyone typing `http://` is automatically sent to `https://`

Certbot edits your nginx config for you, adds the certificate lines, and reloads.

Expected ending: `Congratulations! You have successfully enabled HTTPS on ...`

### Step 11.3 — Verify

Open each of these:

- `https://nandamhandlooms.com` — padlock icon, site loads
- `https://www.nandamhandlooms.com` — padlock, site loads
- `https://api.nandamhandlooms.com/health` — shows `{"status":"ok",...}`
- `http://nandamhandlooms.com` — automatically becomes `https://`

### Step 11.4 — Confirm auto-renewal works

Certificates expire every 90 days. Certbot installs a timer to renew them automatically. Test that the renewal actually works, without using up a real renewal:

```bash
sudo certbot renew --dry-run
```

Must end with `Congratulations, all simulated renewals succeeded`.

Also confirm the timer is active:

```bash
sudo systemctl status snap.certbot.renew.timer
```

---

## PART 12 — Razorpay live keys and webhook

Do this part once your Razorpay KYC is approved.

### Step 12.1 — Get live keys

1. https://dashboard.razorpay.com
2. Switch the toggle at the top from **Test Mode** to **Live Mode**
3. **Settings → API Keys → Generate Live Key**
4. Copy **Key ID** (`rzp_live_...`) and **Key Secret** — the secret is shown **once only**
5. Paste both into `deployment-notes.txt`

### Step 12.2 — Create the webhook

The webhook is what saves you when a customer pays and then closes the browser before the page finishes confirming. Without it, the money is taken but the order stays unconfirmed.

1. Razorpay Dashboard → **Settings → Webhooks → Add New Webhook**
2. Webhook URL: `https://api.nandamhandlooms.com/api/v1/webhooks/razorpay`
3. Secret: invent a long random string (or generate one with the `node -e` command from Step 2.7) — **you choose this value**, and you must paste the same value into your `.env`
4. Active Events: tick **`payment.captured`**
5. **Create Webhook**

### Step 12.3 — Put the keys on the server

```bash
# [SERVER]
nano /var/www/nandamhandlooms/app/backend/.env
```

Update these three lines:

```
RAZORPAY_KEY_ID="rzp_live_xxxxxxxxxx"
RAZORPAY_KEY_SECRET="xxxxxxxxxxxxxxxx"
RAZORPAY_WEBHOOK_SECRET="the secret you invented in step 12.2"
```

Save and restart:

```bash
pm2 restart nandam-api
pm2 logs nandam-api --lines 20
```

You should now see:

```
  payments: razorpay LIVE — webhook enabled
```

If it says `test` instead of `LIVE`, you pasted the test key. If it says `webhook DISABLED`, the webhook secret line is missing or misspelled.

---

## PART 13 — SMS / OTP (MSG91)

Do this once your DLT template is approved. **Until this is done, no new customer can register and no new staff member can activate their account.**

### Step 13.1 — Get your MSG91 details

From https://control.msg91.com:

- **Auth Key** — Settings / API section
- **Sender ID** — your 6-character DLT-registered header, e.g. `NANDAM`
- **Template ID** — from the Flow / Template you created and got DLT-approved

Your template must contain a variable for the OTP code. A typical approved body:

```
Your Nandam Handlooms verification code is ##OTP##. Valid for 10 minutes. Do not share it with anyone.
```

### Step 13.2 — Put them on the server

```bash
# [SERVER]
nano /var/www/nandamhandlooms/app/backend/.env
```

Change:

```
SMS_PROVIDER=msg91
MSG91_AUTH_KEY="<your auth key>"
MSG91_TEMPLATE_ID="<your template id>"
MSG91_SENDER_ID="<your sender id>"
```

Save, then:

```bash
pm2 restart nandam-api
pm2 logs nandam-api --lines 20
```

### Step 13.3 — Test with a real phone

Go to `https://nandamhandlooms.com`, start customer registration with your own mobile number, and confirm the SMS actually arrives. Do this before you tell the client anything is ready — DLT rejections are common and only show up at send time.

---

## PART 14 — Build the Android APK

All `[PC]` unless marked otherwise.

### Step 14.1 — Install the EAS CLI

```powershell
npm install -g eas-cli
eas --version
```

### Step 14.2 — Log in

```powershell
eas login
```

Enter your Expo account email and password.

### Step 14.3 — Check the project ownership

Your `app.json` already contains an EAS project ID: `3f1e6196-d244-4e12-9993-ca68992aa9b6`. That ID belongs to whichever Expo account first created it.

```powershell
cd D:\Handlooms\Nadam-Handloom\frontend\app
eas project:info
```

- **If it prints the project details**, you own it. Continue to 14.4.
- **If it errors with "not found" or "no access"**, the project belongs to someone else's account. Fix it by claiming a fresh one:

```powershell
# Only if the check above failed
eas init --force
```

This replaces the `projectId` inside `app.json` with one on your account. Commit that change afterwards.

### Step 14.4 — Point the APK at your live API

```powershell
notepad D:\Handlooms\Nadam-Handloom\frontend\app\eas.json
```

Find the `production` block and replace the placeholder:

```json
"production": {
  "autoIncrement": true,
  "android": {
    "buildType": "apk"
  },
  "env": {
    "EXPO_PUBLIC_API_URL": "https://api.nandamhandlooms.com"
  }
}
```

**Critical detail:** no trailing slash, and **no `/api/v1` on the end**. Your app appends `/api/v1` itself. Getting this wrong produces an app that installs fine and then fails every single request — the most common and most confusing APK problem.

Save and close.

### Step 14.5 — Commit the change

```powershell
cd D:\Handlooms\Nadam-Handloom
git add -A
git commit -m "Point production APK at live API"
git push origin main
```

### Step 14.6 — Start the build

```powershell
cd D:\Handlooms\Nadam-Handloom\frontend\app
eas build --platform android --profile production
```

Prompts you will see:

- **"Generate a new Android Keystore?"** → **Yes**. Expo creates and stores the signing key for you.
- It may ask to install `expo-dev-client` or similar — say no unless it blocks the build.

The build is queued on Expo's servers. It takes **10–25 minutes** on the free tier. The terminal shows a link like `https://expo.dev/accounts/<you>/projects/nandam-handlooms-staff/builds/<id>` — open it to watch progress. You can close the terminal; the build continues.

### Step 14.7 — Back up the signing keystore immediately

This is the step everyone skips and later regrets. The keystore is what proves an update is from the same publisher. **Lose it and you can never ship an update to anyone who installed this APK** — they would have to uninstall and reinstall a differently-signed app, losing their data.

```powershell
eas credentials
```

Navigate: select **Android** → **production** → **Keystore** → **Download existing keystore**.

Save the downloaded `.jks` file and the printed passwords into `deployment-notes.txt` and into a backup location that is not your laptop (password manager, encrypted drive).

### Step 14.8 — Download the APK

When the build finishes, the terminal (and the build page) gives a download URL. Download it and rename it clearly:

```
nandam-handlooms-staff-v1.0.0.apk
```

---

## PART 15 — Test everything

Work through this list in order and tick each one. Anything that fails, fix before showing the client.

### 15.1 Server health

| # | Check | How | Expected |
|---|-------|-----|----------|
| 1 | API is up | `https://api.nandamhandlooms.com/health` | `{"status":"ok",...}` |
| 2 | PM2 running | `[SERVER] pm2 list` | `nandam-api` status `online`, restarts low |
| 3 | Nginx running | `[SERVER] sudo systemctl status nginx` | `active (running)` |
| 4 | Disk not filling | `[SERVER] df -h` | `/` under 70% used |
| 5 | Memory sane | `[SERVER] free -h` | some free RAM, swap barely touched |
| 6 | No errors in log | `[SERVER] pm2 logs nandam-api --lines 100` | no repeating stack traces |

### 15.2 Website

| # | Check | Expected |
|---|-------|----------|
| 1 | `https://nandamhandlooms.com` loads | Homepage with images |
| 2 | Padlock in address bar | Valid certificate, no warning |
| 3 | `http://nandamhandlooms.com` | Redirects to `https://` |
| 4 | `https://www.nandamhandlooms.com` | Loads, padlock |
| 5 | Product images appear | Loading from the S3 bucket |
| 6 | Browse categories, open a product | Data loads from the live database |
| 7 | Refresh the page while on a product URL | Still loads, no 404 (this tests `try_files`) |
| 8 | Open on a phone | Layout works, nothing overflows |
| 9 | Browser console (F12) | No red CORS errors, no failed requests |

### 15.3 Customer flow end to end

1. Register a new customer with a real mobile number → **OTP SMS arrives**
2. Add a product to the cart
3. Add a delivery address
4. Checkout → Razorpay window opens → pay ₹1 with a real card or UPI
5. Order shows as confirmed
6. **Refund that ₹1 from the Razorpay dashboard** so you are not out of pocket
7. In Razorpay → **Settings → Webhooks → your webhook → Recent Deliveries**: the `payment.captured` event shows a **200** response

Step 7 is the one that proves your webhook is wired correctly. A non-200 there means orders will be left hanging whenever a customer closes the tab.

### 15.4 Staff APK

Install the APK on an Android phone (see Part 16 for how), then:

| # | Check | Why it matters |
|---|-------|----------------|
| 1 | App opens without crashing | Basic build sanity |
| 2 | Log in with the `SEED_ADMIN_MOBILE` + `SEED_ADMIN_MPIN` from Step 7.3 | Proves the app reaches the live API |
| 3 | **Immediately change that MPIN** | The seed MPIN is written in your notes and your env file |
| 4 | Product list loads with images | API + S3 read |
| 5 | Add a product and upload a photo from the gallery | **This is the IAM role test.** If it fails, Step 4.3's instance profile is missing |
| 6 | Scan a barcode with the camera | Camera permission is correctly declared |
| 7 | Open Inventory | Live data |
| 8 | Open Analytics | Aggregate queries work over the network |
| 9 | Generate an invoice PDF and share it | PDF generation, the slowest operation on a small instance |
| 10 | Generate a category catalog PDF | Same, plus S3 upload |
| 11 | Turn WiFi off then on | The offline banner appears and clears |
| 12 | Close the app, reopen it | Still logged in (secure token storage works) |
| 13 | Put the phone on **mobile data only** | Proves it uses the public API, not your home WiFi |

Check 13 is important. On your home WiFi a misconfigured app can still reach a development machine and appear to work. On mobile data it cannot.

### 15.5 Security pass

| # | Check | How |
|---|-------|-----|
| 1 | Port 4000 is not reachable from outside | `[PC] curl http://<SERVER_IP>:4000/health` → must **time out** |
| 2 | SSH is restricted to your IP | EC2 → Security Groups → inbound rule for 22 is not `0.0.0.0/0` |
| 3 | `.env` is not world-readable | `[SERVER] ls -l backend/.env` → shows `-rw-------` |
| 4 | `.env` is not on GitHub | Search the repo on github.com for `DATABASE_URL` |
| 5 | Price code word changed | Not `BLACKHORSE` |
| 6 | JWT secrets differ from development | Compare against your local `.env` |
| 7 | SSL grade | Run `https://nandamhandlooms.com` through https://www.ssllabs.com/ssltest/ → A or better |

---

## PART 16 — Share the APK with the client

### Option A — Expo's hosted link (easiest)

Your build page at `https://expo.dev/accounts/<you>/projects/nandam-handlooms-staff/builds/<id>` has a **shareable link and a QR code**. Send the client that link. They open it on their Android phone and tap Install.

The link stays live for 30 days on the free plan. Good for the first handover; not good as a permanent distribution channel.

### Option B — Host the APK on your own S3 bucket (permanent)

```powershell
# [PC] — requires AWS CLI, which you already have configured
aws s3 cp nandam-handlooms-staff-v1.0.0.apk s3://nandamhandlooms-media/apk/nandam-handlooms-staff-v1.0.0.apk --content-type application/vnd.android.package-archive
```

The download link is then:

```
https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/apk/nandam-handlooms-staff-v1.0.0.apk
```

This URL never expires and you control it. Use a versioned filename so you can ship `v1.0.1` later without breaking the old link.

### Step 16.1 — Message to send the client

Send this along with the link:

---

> **Nandam Handlooms — Staff App (Android)**
>
> **Website:** https://nandamhandlooms.com
> **App download:** `<your link>`
>
> **How to install (Android only — this app is not on the Play Store):**
>
> 1. Open the download link on your Android phone
> 2. Tap the file to install. Android will warn that the app is from an unknown source — this is normal for apps installed outside the Play Store
> 3. Tap **Settings** in that warning → turn on **Allow from this source** → press Back
> 4. Tap **Install**, then **Open**
> 5. If a "Play Protect" warning appears, tap **Install anyway**
>
> **Your login:**
> Mobile: `<their mobile>`
> MPIN: `<temporary MPIN>`
>
> **Please change the MPIN the first time you log in** (Profile → Change MPIN).
>
> **Please test and tell me if anything looks wrong:**
> - Log in
> - View the product list — do images load?
> - Add one test product with a photo
> - Scan a barcode
> - Generate one invoice PDF
>
> The app needs an internet connection. It works on both WiFi and mobile data.

---

### Step 16.2 — What to tell them about iPhone

This APK is Android only. iPhone distribution requires an Apple Developer account (US$99/year) and either TestFlight or the App Store. If the client asks, that is a separate piece of work — your code already supports iOS (`bundleIdentifier` is set), but it needs that account and a review process.

---

## PART 17 — Living with it afterwards

### 17.1 Deploying a code change

Create this script once:

```bash
# [SERVER]
nano /var/www/nandamhandlooms/deploy.sh
```

Paste:

```bash
#!/bin/bash
set -e
cd /var/www/nandamhandlooms/app

echo "--> Pulling latest code"
git pull origin main

echo "--> Backend"
cd backend
npm ci --omit=dev
npx prisma generate
npx prisma migrate deploy
npm run build

echo "--> Website"
cd ../frontend/customer-web
npm ci
npm run build

echo "--> Restarting API"
pm2 restart nandam-api

echo "--> Done."
pm2 list
```

Make it executable:

```bash
chmod +x /var/www/nandamhandlooms/deploy.sh
```

From then on, deploying a change is:

```bash
# [PC]
git push origin main

# [SERVER]
/var/www/nandamhandlooms/deploy.sh
```

There is ~20 seconds of downtime on the API while it restarts. The website itself stays up throughout.

### 17.2 Everyday commands

| What you want | Command `[SERVER]` |
|---------------|--------------------|
| Watch live API logs | `pm2 logs nandam-api` |
| Last 200 log lines | `pm2 logs nandam-api --lines 200` |
| Restart the API | `pm2 restart nandam-api` |
| Is it running? | `pm2 list` |
| Memory / CPU dashboard | `pm2 monit` |
| Nginx error log | `sudo tail -50 /var/log/nginx/error.log` |
| Reload nginx after a config edit | `sudo nginx -t && sudo systemctl reload nginx` |
| Disk space | `df -h` |
| Memory | `free -h` |

### 17.3 Stop logs from filling the disk

PM2 logs grow forever and eventually fill the 30 GB disk, which takes the site down.

```bash
sudo pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 20M
pm2 set pm2-logrotate:retain 14
```

### 17.4 Backups

- **Database** — Neon's history retention (Step 2.5) covers accidental deletion. For an off-site copy, run this monthly on your PC:
  ```powershell
  pg_dump "<PRODUCTION DIRECT_URL>" -Fc -f "handloom-$(Get-Date -Format yyyy-MM-dd).dump"
  ```
- **Images and PDFs** — enable **Versioning** on the S3 bucket (S3 → bucket → Properties → Bucket Versioning → Enable). Deleted or overwritten files stay recoverable.
- **Server** — you do not need to back up the server itself. Everything on it is either in GitHub or in the `.env` file. Keep `deployment-notes.txt` safe and you can rebuild the whole server from this document in about an hour.

### 17.5 Security upkeep

```bash
# [SERVER] — monthly
sudo apt update && sudo apt upgrade -y
sudo reboot
```

PM2 and nginx both come back automatically after reboot, because of Step 7.10. Verify with `https://api.nandamhandlooms.com/health` a minute after rebooting.

Also: rotate your GitHub Personal Access Token when it expires (90 days from Step 1.7).

---

## APPENDIX A — Using AWS RDS instead of Neon

Only do this if the client requires all data inside their own AWS account. It costs more and you take on backup and patching duties.

### A.1 Create the database

1. AWS Console → **RDS** → **Create database**
2. Engine: **PostgreSQL**, latest version
3. Template: **Production** (or **Dev/Test** to cut cost)
4. DB instance identifier: `nandam-handlooms-db`
5. Master username: `handloomadmin`, and let RDS auto-generate the password — **copy it, it is shown once**
6. Instance class: **db.t4g.micro** (upgrade later if slow)
7. Storage: 20 GB gp3, **enable storage autoscaling**
8. **Connectivity → Compute resource: Connect to an EC2 compute resource** → pick `nandam-handlooms-prod`. This is the important part: RDS then creates the security group rules so only your server can reach the database, and the database gets **no public endpoint**.
9. Enable **automated backups**, retention 7 days
10. **Create database** — takes 10–15 minutes

### A.2 Connection strings

RDS gives one endpoint, e.g. `nandam-handlooms-db.abc123.ap-south-1.rds.amazonaws.com`. There is no separate pooler, so both variables use the same value:

```
DATABASE_URL="postgresql://handloomadmin:<password>@<endpoint>:5432/postgres?sslmode=require"
DIRECT_URL="postgresql://handloomadmin:<password>@<endpoint>:5432/postgres?sslmode=require"
```

Put those in `.env` in place of the Neon ones, then run Steps 7.4 → 7.6 as normal.

### A.3 What you now own that Neon handled

- Minor version upgrades (RDS schedules a maintenance window — pick a night-time slot)
- Monitoring free storage before it runs out
- Testing that your snapshots actually restore
- There is no branching, so you cannot cheaply clone production for testing

---

## APPENDIX B — Building the APK locally instead of on EAS

Use this if you cannot or will not use Expo's build servers.

### B.1 Install the toolchain (one time, ~8 GB)

1. **JDK 17** — https://adoptium.net → Temurin 17 (LTS) for Windows x64
2. **Android Studio** — https://developer.android.com/studio
   During setup make sure these are ticked: **Android SDK**, **Android SDK Platform 35**, **Android SDK Build-Tools**, **Android SDK Command-line Tools**
3. Set environment variables (PowerShell as Administrator, then **restart PowerShell**):

```powershell
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
[Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Eclipse Adoptium\jdk-17.0.x-hotspot", "User")
```

(Correct the JDK path to match what actually got installed.)

### B.2 Create your own signing keystore

**Back this file up immediately and permanently. Losing it means no future updates.**

```powershell
cd D:\Handlooms\Nadam-Handloom\frontend\app
& "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -v -storetype PKCS12 -keystore nandam-release.keystore -alias nandam -keyalg RSA -keysize 2048 -validity 10000
```

It asks for a password and your organisation details. Record the password in `deployment-notes.txt`.

### B.3 Generate the native Android project

```powershell
npx expo prebuild --platform android --clean
```

This creates an `android` folder from your `app.json` configuration.

### B.4 Wire the keystore in

Create `android\gradle.properties` entries:

```
NANDAM_STORE_FILE=nandam-release.keystore
NANDAM_KEY_ALIAS=nandam
NANDAM_STORE_PASSWORD=<your password>
NANDAM_KEY_PASSWORD=<your password>
```

Move the keystore into `android\app\`, and in `android\app\build.gradle` add a `release` entry under `signingConfigs` referencing those properties, then point `buildTypes.release.signingConfig` at it.

### B.5 Build

```powershell
$env:EXPO_PUBLIC_API_URL="https://api.nandamhandlooms.com"
cd android
.\gradlew assembleRelease
```

The APK appears at:

```
android\app\build\outputs\apk\release\app-release.apk
```

First build takes 15–30 minutes. Later builds are much faster.

> Note the env var must be set **in the same shell** before the gradle command — Expo inlines `EXPO_PUBLIC_*` values at build time, so setting it afterwards has no effect.

---

## APPENDIX C — Troubleshooting

### Website shows "502 Bad Gateway"

Nginx is running but the backend is not answering.

```bash
pm2 list                            # is nandam-api online?
pm2 logs nandam-api --lines 100     # what did it say before dying?
curl http://127.0.0.1:4000/health   # does it answer locally?
```

Usual cause: the backend crashed on startup because of a bad value in `.env` — most often an unquoted `DATABASE_URL` or a JWT secret shorter than 16 characters.

### Website loads but every API call fails

Open the browser console (F12 → Network). Look at the failing request URL.

- Request goes to `localhost:4000` → the website was built with a stale `VITE_API_URL`. Rebuild without it (Step 8.2).
- Request goes to the right place but returns 502 → see above.
- CORS error in the console → `FRONTEND_URL` in `.env` does not exactly match the browser's address. It must be `https://nandamhandlooms.com` with no trailing slash.

### Refreshing a product page gives 404

The `try_files $uri $uri/ /index.html;` line is missing or in the wrong `location` block. Recheck Step 9.2.

### Image upload fails from the staff app

```bash
pm2 logs nandam-api --lines 50
```

- `CredentialsProviderError` → the IAM role was not attached at launch. Fix without recreating the instance: EC2 → select instance → **Actions → Security → Modify IAM role** → pick `NandamHandloomsServerRole` → Update. Then `pm2 restart nandam-api`.
- `AccessDenied` → the policy is attached but its `Resource` ARN does not match your bucket name.
- `413 Request Entity Too Large` → `client_max_body_size` is missing from the nginx block.

### Certbot fails with "Timeout during connect"

DNS is not fully propagated, or port 80 is blocked. Confirm `nslookup` returns your IP for all three names, and that your security group allows port 80 from `0.0.0.0/0`. Then wait 15 minutes and retry — Let's Encrypt rate-limits repeated failures.

### APK installs but every screen says "Could not reach the server"

Almost always `EXPO_PUBLIC_API_URL`. Check in this order:

1. Open `https://api.nandamhandlooms.com/health` in the phone's browser. If that fails, the problem is the server, not the app.
2. Confirm `eas.json` has `https://api.nandamhandlooms.com` — no trailing slash, no `/api/v1`.
3. Confirm you built the **`production`** profile, not `preview`. The `preview` profile has no `env` block, so it falls back to looking for a development machine on the local network.

### "Killed" during npm install or npm run build

Out of memory. Confirm swap is on with `free -h`. If `Swap:` shows `0B`, redo Step 6.2.

### Server reboots and the site does not come back

`pm2 startup` was not completed. SSH in, run `pm2 resurrect` to bring it back now, then redo Step 7.10 properly — including running the long `sudo env PATH=...` line it prints.

---

## APPENDIX D — Quick reference card

Keep this filled in at the top of `deployment-notes.txt`.

```
SERVER_IP            =
SSH KEY              = C:\Users\goran\.ssh\nandam-handlooms-key.pem
SSH COMMAND          = ssh -i "$env:USERPROFILE\.ssh\nandam-handlooms-key.pem" ubuntu@<SERVER_IP>

WEBSITE              = https://nandamhandlooms.com
API                  = https://api.nandamhandlooms.com
HEALTH CHECK         = https://api.nandamhandlooms.com/health

APP CODE ON SERVER   = /var/www/nandamhandlooms/app
BACKEND ENV FILE     = /var/www/nandamhandlooms/app/backend/.env
NGINX CONFIG         = /etc/nginx/sites-available/nandamhandlooms
DEPLOY SCRIPT        = /var/www/nandamhandlooms/deploy.sh

PM2 PROCESS NAME     = nandam-api
AWS REGION           =
IAM ROLE             = NandamHandloomsServerRole
S3 BUCKET            = nandamhandlooms-media (ap-south-1)

NEON PROJECT         =
NEON BRANCH          = production

EXPO ACCOUNT         =
ANDROID PACKAGE      = com.nandamhandlooms.staff
KEYSTORE BACKUP AT   =

GITHUB TOKEN EXPIRES =
SSL RENEWS           = automatic, every 90 days
```

---

## Order of operations — the short version

| Part | What | How long | Can it run in parallel? |
|------|------|----------|-------------------------|
| 0 | Start MSG91 DLT + Razorpay KYC | 15 min to apply, **2–5 days to approve** | **Start this first, then continue** |
| 1 | Push code to GitHub | 20 min | |
| 2 | Neon production database | 15 min | |
| 3 | S3 + IAM role | 15 min | |
| 4 | Launch EC2 | 20 min | |
| 5 | SSH in | 5 min | |
| 6 | Base server setup | 30 min | |
| 7 | Deploy backend | 30 min | |
| 8 | Build website | 15 min | |
| 9 | Nginx | 20 min | |
| 10 | DNS | 10 min + **up to a few hours to propagate** | Do Part 14 while you wait |
| 11 | SSL | 10 min | |
| 12 | Razorpay live | 15 min | after KYC approval |
| 13 | MSG91 SMS | 15 min | after DLT approval |
| 14 | Build APK | 15 min + 25 min build | can overlap with Part 10 |
| 15 | Test everything | 1–2 hours | |
| 16 | Share with client | 15 min | |

**Realistic timeline:** one focused day gets you a live website with HTTPS and a working APK. Payments and OTP go live a few days later when the approvals land.
