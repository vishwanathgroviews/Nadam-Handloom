import { Request, Response, NextFunction } from 'express';

/**
 * Column definition for schema-aware validation.
 * Map your PostgreSQL table columns here.
 */
interface ColumnDef {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'uuid' | 'email' | 'date';
  required: boolean;
  maxLength?: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateValue(value: unknown, col: ColumnDef): string | null {
  switch (col.type) {
    case 'string':
      if (typeof value !== 'string') return `${col.name} must be a string`;
      if (col.maxLength && value.length > col.maxLength) return `${col.name} exceeds max length ${col.maxLength}`;
      break;
    case 'number':
      if (typeof value !== 'number' || Number.isNaN(value)) return `${col.name} must be a number`;
      break;
    case 'boolean':
      if (typeof value !== 'boolean') return `${col.name} must be a boolean`;
      break;
    case 'uuid':
      if (typeof value !== 'string' || !UUID_RE.test(value)) return `${col.name} must be a valid UUID`;
      break;
    case 'email':
      if (typeof value !== 'string' || !EMAIL_RE.test(value)) return `${col.name} must be a valid email`;
      break;
    case 'date':
      if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return `${col.name} must be a valid ISO date`;
      break;
  }
  return null;
}

/**
 * Factory: returns Express middleware that validates req.body
 * against the provided PostgreSQL column schema.
 *
 * Usage:
 *   router.post('/users', validateSchema(userColumns), createUser);
 */
export function validateSchema(columns: ColumnDef[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];
    const body = req.body ?? {};

    for (const col of columns) {
      const value = body[col.name];

      if (value === undefined || value === null || value === '') {
        if (col.required) {
          errors.push(`${col.name} is required`);
        }
        continue;
      }

      const typeErr = validateValue(value, col);
      if (typeErr) errors.push(typeErr);
    }

    // Reject unknown fields
    const knownKeys = new Set(columns.map(c => c.name));
    for (const key of Object.keys(body)) {
      if (!knownKeys.has(key)) {
        errors.push(`Unknown field: ${key}`);
      }
    }

    if (errors.length > 0) {
      res.status(400).json({ error: 'Validation failed', details: errors });
      return;
    }

    next();
  };
}

// ─── Example column definitions (mirror your PG table) ───
export const authAccountColumns: ColumnDef[] = [
  { name: 'email',    type: 'email',  required: true,  maxLength: 255 },
  { name: 'phone',    type: 'string', required: false, maxLength: 20 },
  { name: 'password', type: 'string', required: true,  maxLength: 128 },
  { name: 'firstName', type: 'string', required: true, maxLength: 100 },
  { name: 'lastName',  type: 'string', required: true, maxLength: 100 },
];
