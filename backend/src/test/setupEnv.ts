// Hermetic dummy env config so tests never depend on a local .env file.
process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-not-for-production';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-not-for-production';
process.env.FRONTEND_URL ??= 'http://localhost:5173';
process.env.SMS_PROVIDER ??= 'console';
