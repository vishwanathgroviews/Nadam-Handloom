# AI Backend Developer Task: Authentication & Authorization Module

## Objective
Build a headless, secure, enterprise-grade Authentication and Authorization RESTful (or GraphQL) API backend service. Do NOT build any frontend UI. Build clean, modular code with strict input validation, database migrations, and unit tests.

## Tech Stack Requirements
- **Clients (Consumers):** React (Web) and React Native (Mobile)
- **Language/Framework:** Node.js and Express
- **Database:** PostgreSQL
- **Hashing Security:** Argon2id (preferred) or bcrypt (cost factor 12)
- **Token Management:** JWT Access Tokens (Short-lived: 15m) + Database-backed Refresh Tokens (Long-lived: 7d stored as HTTP-Only, Secure, SameSite Cookies)

---

## Core Task Breakdown

### Phase 1: Database Setup & Migrations
1. Implement the SQL Schema provided above. Ensure foreign keys, cascades, indices (on `email`, `refresh_token_hash`, `token_hash`), and constraints are initialized.
2. Create seed scripts for system roles (`ADMIN`, `STAFF`, `CUSTOMER`) and core resource permissions.

### Phase 2: Core Authentication Logic
Implement API controllers and services for:

1. **Customer Self Sign-Up (`POST /api/v1/auth/register`)**
   - Accept: `email`, `phone`, `password`, `first_name`, `last_name`.
   - Action: Hash password with Argon2id. Create `AUTH_ACCOUNT` and linked `USER_PROFILE` in a single DB transaction. Default role: `CUSTOMER`. Trigger email verification OTP.

2. **Admin / Staff Provisioning (`POST /api/v1/admin/users`)**
   - Protected: Admin only.
   - Accept: `email`, `phone`, `first_name`, `last_name`, `role_id`, `employee_id`, `department`, `job_title`.
   - Action: Create `AUTH_ACCOUNT` and `ADMIN_PROFILES`. Generate password reset token and send invite email.

3. **Multi-Factor / Universal Login (`POST /api/v1/auth/login`)**
   - Accept: `email` (or `phone`), `password`, `platform`, `device_name`.
   - Process:
     - Verify status != `locked` or `suspended`.
     - Check account locking logic (if `failed_login_attempts >= 5`, set `locked_until = NOW() + 15 mins`).
     - If user is `ADMIN` / `STAFF` or has MFA enabled: Generate `OTP_CODE`, store hash, return temporary `mfa_required` token.
     - If verified: Issue JWT Access Token + HTTP-Only Refresh Token Cookie, log entry in `SESSIONS` and `AUTH_EVENTS`. Reset `failed_login_attempts`.

4. **Token Refresh Flow (`POST /api/v1/auth/refresh`)**
   - Accept: Refresh Token from Cookie or Payload.
   - Validate token against `SESSIONS`. Check if `revoked_at` is null, not expired, and `is_compromised = false`.
   - Rotate refresh token (revoke old, issue new) to prevent token reuse attacks.

5. **OTP Management (`POST /api/v1/auth/otp/verify`, `/resend`)**
   - Verify 6-digit OTP code against `OTP_CODES.code_hash`.
   - Check `attempts < 3`, `expires_at > NOW()`, and enforcement of `resend_available_at`. Mark `used = true` on success.

6. **Password Reset Cycle (`POST /api/v1/auth/password-reset/request`, `/confirm`)**
   - Request: Generate token, store hash in `PASSWORD_RESET_TOKENS`, emit event.
   - Confirm: Validate token hash, update `AUTH_ACCOUNTS.password_hash`, set `password_changed_at = NOW()`, regenerate `security_stamp` (invalidates all active sessions).

7. **Logout (`POST /api/v1/auth/logout`)**
   - Revoke target session in `SESSIONS` table (`revoked_at = NOW()`). Clear cookies.

---

### Phase 3: Authorization Middleware (RBAC)
1. **JWT Verification Middleware:** Parse Bearer Token, check token expiration, fetch `security_stamp`.
2. **Role & Permission Guard:**
   - Attach middleware to routes (e.g., `@RequirePermissions('users:delete')`).
   - Query junction tables (`USER_ROLES` $\rightarrow$ `ROLE_PERMISSIONS` $\rightarrow$ `PERMISSIONS`) to grant or deny API execution.

---

### Phase 4: Audit & Security Interceptors
1. **Audit Logger:** Create an asynchronous worker/interceptor that writes every login failure, role change, and password reset into `AUTH_EVENTS`.
2. **Rate Limiter:** Implement rate limiting middleware (e.g., Redis rate-limiter) on `/login`, `/otp/verify`, and `/password-reset/request` (max 5 requests per minute per IP).

---

## Enterprise Security & Architecture Standards

### 1. Database & Schema Enhancements
- **Soft Deletes & Audit Trails:** All tables must include `created_at`, `updated_at`, and `deleted_at`. Log `ip_address` and `user_agent` in `AUTH_EVENTS`.
- **Transactions:** DB transactions must be used for multi-table inserts (e.g., auth account + profile).

### 2. Core Authentication Security
- **Generic Error Messages:** Endpoints must return "Invalid credentials" rather than revealing if an account exists.
- **CSRF Protection:** Enforce `SameSite=Strict` for HTTP-Only refresh token cookies.
- **Password Policies:** Strict validation (min 8 chars, 1 uppercase, 1 number, 1 special character) prior to hashing.

### 3. MFA & OTP Management
- **OTP Expiry & Locking:** Use Redis for storing OTPs with a strict TTL (e.g., 5 minutes) and tracking `failed_login_attempts`.

### 4. Authorization & Rate Limiting
- **Redis-backed Rate Limiter:** Max 5 requests/min per IP on `/login`, `/otp`, and `/password-reset`.
- **Centralized Exception Handling:** Implement a global error handler to securely log unauthorized attempts without crashing or leaking stack traces.

---

## Deliverables Checklist
- [ ] Working migration scripts & DB seeders.
- [ ] RESTful API endpoints for all 3 lifecycle roles (Customer, Staff, Admin).
- [ ] Environment variables configured (`JWT_SECRET`, `ARGON_SALT`, `DATABASE_URL`, `REDIS_URL`).
- [ ] Complete Postman / OpenAPI (Swagger) spec documenting request/response payloads for UI developers.