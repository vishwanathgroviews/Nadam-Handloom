import { Pool, PoolClient, QueryResult } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[PG Pool] Unexpected error on idle client:', err.message);
});

/**
 * PostgreSQL error codes → clean HTTP responses.
 */
interface PgError extends Error {
  code?: string;
  detail?: string;
  constraint?: string;
  column?: string;
  table?: string;
}

interface QueryResponse<T = any> {
  success: boolean;
  data?: T;
  statusCode: number;
  error?: string;
  detail?: string;
}

function mapPgError(err: PgError): QueryResponse {
  const code = err.code ?? '';

  switch (code) {
    // Unique violation (e.g., duplicate email)
    case '23505':
      return {
        success: false,
        statusCode: 400,
        error: 'Duplicate entry',
        detail: `A record with this value already exists${err.constraint ? ` (constraint: ${err.constraint})` : ''}.`,
      };

    // Not-null violation
    case '23502':
      return {
        success: false,
        statusCode: 400,
        error: 'Missing required field',
        detail: `Column "${err.column}" cannot be null${err.table ? ` in table "${err.table}"` : ''}.`,
      };

    // Foreign key violation
    case '23503':
      return {
        success: false,
        statusCode: 400,
        error: 'Invalid reference',
        detail: `Referenced record does not exist${err.constraint ? ` (constraint: ${err.constraint})` : ''}.`,
      };

    // Check constraint violation
    case '23514':
      return {
        success: false,
        statusCode: 400,
        error: 'Check constraint failed',
        detail: err.detail ?? 'A value violates a check constraint.',
      };

    // Invalid text representation (e.g., "abc" for an integer column)
    case '22P02':
      return {
        success: false,
        statusCode: 400,
        error: 'Invalid input syntax',
        detail: err.message.replace(/^ERROR:\s*/, ''),
      };

    // Numeric value out of range
    case '22003':
      return {
        success: false,
        statusCode: 400,
        error: 'Numeric value out of range',
        detail: err.message.replace(/^ERROR:\s*/, ''),
      };

    // Connection errors
    case '08000':
    case '08001':
    case '08003':
    case '08006':
      return {
        success: false,
        statusCode: 503,
        error: 'Database unavailable',
        detail: 'The database is temporarily unreachable. Please try again later.',
      };

    default:
      console.error('[PG Query] Unhandled PG error:', code, err.message);
      return {
        success: false,
        statusCode: 500,
        error: 'Internal server error',
        detail: 'An unexpected database error occurred.',
      };
  }
}

/**
 * Execute a parameterised query with full PG error code mapping.
 *
 * Usage:
 *   const result = await safeQuery<User>(
 *     'INSERT INTO auth_accounts (email, password_hash) VALUES ($1, $2) RETURNING *',
 *     [email, hash]
 *   );
 *   if (!result.success) return res.status(result.statusCode).json(result);
 *   res.json(result.data);
 */
export async function safeQuery<T = any>(
  text: string,
  params?: any[]
): Promise<QueryResponse<T[]>> {
  let client: PoolClient | undefined;

  try {
    client = await pool.connect();
    const result: QueryResult<T> = await client.query(text, params);
    return { success: true, statusCode: 200, data: result.rows };
  } catch (err: any) {
    return mapPgError(err);
  } finally {
    client?.release();
  }
}

/**
 * Run multiple queries inside a single transaction.
 *
 * Usage:
 *   const result = await safeTransaction(async (client) => {
 *     await client.query('INSERT INTO ...', []);
 *     await client.query('INSERT INTO ...', []);
 *     return rows;
 *   });
 */
export async function safeTransaction<T = any>(
  fn: (client: PoolClient) => Promise<T>
): Promise<QueryResponse<T>> {
  let client: PoolClient | undefined;

  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const data = await fn(client);
    await client.query('COMMIT');
    return { success: true, statusCode: 200, data };
  } catch (err: any) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) { /* swallow rollback errors */ }
    }
    return mapPgError(err);
  } finally {
    client?.release();
  }
}

export { pool };
