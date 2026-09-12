import { randomUUID } from 'crypto';

/**
 * A minimal in-memory stand-in for PrismaClient, scoped to exactly the query
 * shapes our auth/RBAC code uses. Not a general Prisma emulator.
 */

type Row = Record<string, any>;
type Db = Record<string, Row[]>;

const MODELS = [
  'authAccount', 'userProfile', 'adminProfile', 'role', 'permission',
  'userRole', 'rolePermission', 'session', 'authEvent', 'otpCode',
  'passwordResetToken', 'apiToken', 'rateLimitHit',
  'category', 'subcategory', 'product', 'productImage', 'address', 'order', 'orderItem', 'payment', 'shipment',
  'piece', 'reservation', 'stockLedger', 'subcategoryCatalogPdf',
  'deviceToken', 'eventsOutbox', 'invoice',
];

type RelationKind = 'hasOne' | 'hasMany' | 'belongsTo';
interface RelationDef {
  kind: RelationKind;
  table: string;
  fk: string;
}

const RELATIONS: Record<string, Record<string, RelationDef>> = {
  authAccount: {
    userProfile: { kind: 'hasOne', table: 'userProfile', fk: 'authAccountId' },
    adminProfile: { kind: 'hasOne', table: 'adminProfile', fk: 'authAccountId' },
    roles: { kind: 'hasMany', table: 'userRole', fk: 'authAccountId' },
  },
  userRole: {
    role: { kind: 'belongsTo', table: 'role', fk: 'roleId' },
    authAccount: { kind: 'belongsTo', table: 'authAccount', fk: 'authAccountId' },
  },
  role: {
    permissions: { kind: 'hasMany', table: 'rolePermission', fk: 'roleId' },
  },
  rolePermission: {
    permission: { kind: 'belongsTo', table: 'permission', fk: 'permissionId' },
    role: { kind: 'belongsTo', table: 'role', fk: 'roleId' },
  },
  session: {
    authAccount: { kind: 'belongsTo', table: 'authAccount', fk: 'authAccountId' },
  },
  deviceToken: {
    authAccount: { kind: 'belongsTo', table: 'authAccount', fk: 'authAccountId' },
  },
  authEvent: {
    authAccount: { kind: 'belongsTo', table: 'authAccount', fk: 'authAccountId' },
  },
  passwordResetToken: {
    authAccount: { kind: 'belongsTo', table: 'authAccount', fk: 'authAccountId' },
  },
  product: {
    category: { kind: 'belongsTo', table: 'category', fk: 'categoryId' },
    subcategory: { kind: 'belongsTo', table: 'subcategory', fk: 'subcategoryId' },
    images: { kind: 'hasMany', table: 'productImage', fk: 'productId' },
    pieces: { kind: 'hasMany', table: 'piece', fk: 'productId' },
    orderItems: { kind: 'hasMany', table: 'orderItem', fk: 'productId' },
    reservations: { kind: 'hasMany', table: 'reservation', fk: 'productId' },
  },
  subcategory: {
    category: { kind: 'belongsTo', table: 'category', fk: 'categoryId' },
    products: { kind: 'hasMany', table: 'product', fk: 'subcategoryId' },
  },
  orderItem: {
    product: { kind: 'belongsTo', table: 'product', fk: 'productId' },
    order: { kind: 'belongsTo', table: 'order', fk: 'orderId' },
  },
  order: {
    items: { kind: 'hasMany', table: 'orderItem', fk: 'orderId' },
    payment: { kind: 'hasOne', table: 'payment', fk: 'orderId' },
    shipment: { kind: 'hasOne', table: 'shipment', fk: 'orderId' },
    invoice: { kind: 'hasOne', table: 'invoice', fk: 'orderId' },
    address: { kind: 'belongsTo', table: 'address', fk: 'addressId' },
    reservations: { kind: 'hasMany', table: 'reservation', fk: 'orderId' },
    authAccount: { kind: 'belongsTo', table: 'authAccount', fk: 'authAccountId' },
  },
  invoice: {
    order: { kind: 'belongsTo', table: 'order', fk: 'orderId' },
  },
  piece: {
    product: { kind: 'belongsTo', table: 'product', fk: 'productId' },
  },
  reservation: {
    product: { kind: 'belongsTo', table: 'product', fk: 'productId' },
    piece: { kind: 'belongsTo', table: 'piece', fk: 'pieceId' },
    order: { kind: 'belongsTo', table: 'order', fk: 'orderId' },
  },
  stockLedger: {
    product: { kind: 'belongsTo', table: 'product', fk: 'productId' },
    piece: { kind: 'belongsTo', table: 'piece', fk: 'pieceId' },
  },
};

// Only the `onDelete: Cascade` relations actually exercised by current flows
// (e.g. purging an Order must also remove its OrderItem/Payment/Shipment
// rows, mirroring the real FKs in schema.prisma) — deliberately not derived
// from RELATIONS above, since that also holds non-cascading relations (e.g.
// Order.reservations has no cascade FK by design; see retention.service.ts).
const CASCADE_ON_DELETE: Record<string, { table: string; fk: string }[]> = {
  order: [
    { table: 'orderItem', fk: 'orderId' },
    { table: 'payment', fk: 'orderId' },
    { table: 'shipment', fk: 'orderId' },
  ],
};

function cascadeDelete(db: Db, modelName: string, id: string) {
  for (const { table, fk } of CASCADE_ON_DELETE[modelName] ?? []) {
    db[table] = (db[table] ?? []).filter((r) => r[fk] !== id);
  }
}

// structuredClone (unlike a JSON round-trip) preserves Date instances, which
// service code relies on comparing with `<`/`>` after reading rows back out.
const clone = <T>(value: T): T => (value === null || value === undefined ? value : structuredClone(value));

// Mirrors the `@default(...)` values in schema.prisma — real Prisma fills these
// in automatically when a create() call omits them; this fake has to do the same.
const SCHEMA_DEFAULTS: Record<string, Row> = {
  authAccount: {
    status: 'active',
    failedLoginAttempts: 0,
    mfaEnabled: false,
    isCompromised: false,
    securityStamp: () => randomUUID(),
  },
  userRole: { assignedAt: () => new Date() },
  session: { isCompromised: false },
  otpCode: { purpose: 'verify', attempts: 0, used: false },
  passwordResetToken: { used: false },
  apiToken: { active: true },
  role: { isSystem: true },
  category: { isActive: true, sortOrder: 0 },
  subcategory: { isActive: true, sortOrder: 0 },
  product: {
    stock: 0,
    isFeatured: false,
    isActive: true,
    occasion: [],
    channelVisibility: 'both',
    trackingMode: 'quantity',
  },
  productImage: { sortOrder: 0 },
  address: { country: 'India', isDefault: false },
  order: { status: 'pending_payment', channel: 'online', placedAt: () => new Date() },
  payment: { provider: 'razorpay', status: 'created' },
  shipment: { carrier: 'DTDC', status: 'not_shipped' },
  piece: { status: 'in_stock' },
  reservation: { quantity: 1, status: 'active' },
  eventsOutbox: { dispatched: false },
  invoice: { generatedAt: () => new Date() },
};

function withDefaults(modelName: string, data: Row): Row {
  const defaults = SCHEMA_DEFAULTS[modelName] ?? {};
  const resolved = Object.fromEntries(
    Object.entries(defaults).map(([key, value]) => [key, typeof value === 'function' ? value() : value])
  );
  return { ...resolved, ...data };
}

function matchesWhere(row: Row, where: Row | undefined, modelName?: string, db?: Db): boolean {
  if (!where) return true;
  for (const [key, condition] of Object.entries(where)) {
    if (key === 'OR') {
      if (!(condition as Row[]).some((sub) => matchesWhere(row, sub, modelName, db))) return false;
      continue;
    }
    if (key === 'AND') {
      if (!(condition as Row[]).every((sub) => matchesWhere(row, sub, modelName, db))) return false;
      continue;
    }

    // Relation filters, e.g. `category: { is: { isActive: true } }` on Product
    // (belongsTo/hasOne) or `items: { some: {...} } }` (hasMany).
    const relation = modelName && db ? RELATIONS[modelName]?.[key] : undefined;
    if (relation && condition && typeof condition === 'object') {
      const cond = condition as any;
      if ('is' in cond || 'equals' in cond) {
        const target = 'is' in cond ? cond.is : cond.equals;
        const related =
          relation.kind === 'belongsTo'
            ? (db![relation.table] ?? []).find((r) => r.id === row[relation.fk])
            : (db![relation.table] ?? []).find((r) => r[relation.fk] === row.id);
        if (!related || !matchesWhere(related, target, relation.table, db)) return false;
        continue;
      }
      if ('some' in cond && relation.kind === 'hasMany') {
        const children = (db![relation.table] ?? []).filter((r) => r[relation.fk] === row.id);
        if (!children.some((c) => matchesWhere(c, cond.some, relation.table, db))) return false;
        continue;
      }
      if ('none' in cond && relation.kind === 'hasMany') {
        const children = (db![relation.table] ?? []).filter((r) => r[relation.fk] === row.id);
        if (children.some((c) => matchesWhere(c, cond.none, relation.table, db))) return false;
        continue;
      }
    }

    // A field never written and one explicitly set to null are the same "no value"
    // state in Postgres/Prisma — a fake row that simply omitted the field (e.g. a
    // nullable column with no @default) must still match `where: { field: null }`.
    const value = row[key] ?? null;
    if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
      const c = condition as any;
      if ('gt' in c && !(value > c.gt)) return false;
      if ('gte' in c && !(value >= c.gte)) return false;
      if ('lt' in c && !(value < c.lt)) return false;
      if ('lte' in c && !(value <= c.lte)) return false;
      if ('in' in c && !c.in.includes(value)) return false;
      if ('notIn' in c && c.notIn.includes(value)) return false;
      if ('contains' in c) {
        const haystack = c.mode === 'insensitive' ? String(value ?? '').toLowerCase() : String(value ?? '');
        const needle = c.mode === 'insensitive' ? String(c.contains).toLowerCase() : String(c.contains);
        if (!haystack.includes(needle)) return false;
      }
      if ('has' in c && !(Array.isArray(value) && value.includes(c.has))) return false;
      if ('hasSome' in c && !(Array.isArray(value) && c.hasSome.some((v: any) => value.includes(v)))) return false;
    } else if (value !== condition) {
      return false;
    }
  }
  return true;
}

function resolveInclude(row: Row, modelName: string, include: Record<string, any>, db: Db): Row {
  const relations = RELATIONS[modelName] ?? {};
  for (const [key, subInclude] of Object.entries(include)) {
    const relation = relations[key];
    if (!relation || !subInclude) continue;

    const nestedInclude = typeof subInclude === 'object' && subInclude.include ? subInclude.include : undefined;

    if (relation.kind === 'belongsTo') {
      const parent = (db[relation.table] ?? []).find((r) => r.id === row[relation.fk]);
      row[key] = parent ? (nestedInclude ? resolveInclude(clone(parent), relation.table, nestedInclude, db) : clone(parent)) : null;
    } else if (relation.kind === 'hasOne') {
      const child = (db[relation.table] ?? []).find((r) => r[relation.fk] === row.id);
      row[key] = child ? (nestedInclude ? resolveInclude(clone(child), relation.table, nestedInclude, db) : clone(child)) : null;
    } else {
      let children = (db[relation.table] ?? []).filter((r) => r[relation.fk] === row.id);
      if (subInclude && typeof subInclude === 'object' && subInclude.orderBy) {
        children = sortRows(children, subInclude.orderBy);
      }
      if (subInclude && typeof subInclude === 'object' && typeof subInclude.take === 'number') {
        children = children.slice(0, subInclude.take);
      }
      row[key] = children.map((child) =>
        nestedInclude ? resolveInclude(clone(child), relation.table, nestedInclude, db) : clone(child)
      );
    }
  }
  return row;
}

// Resolves Prisma's atomic scalar update operators ({increment}/{decrement}/
// {multiply}/{set}) against the row's current value — real Postgres applies
// these atomically server-side; the fake just needs to compute the same result.
function resolveScalarOps(row: Row, patch: Row): Row {
  const resolved: Row = {};
  for (const [key, value] of Object.entries(patch)) {
    // Real Prisma treats a key explicitly set to `undefined` in `data` as
    // "not provided" (this is what makes `{ data: { foo: maybeUndefined } }`
    // partial-update patterns work) — skip it here too, otherwise the
    // Object.assign below would overwrite the existing column with undefined.
    if (value === undefined) continue;
    if (value && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value)) {
      const op = value as any;
      if ('increment' in op) resolved[key] = (row[key] ?? 0) + op.increment;
      else if ('decrement' in op) resolved[key] = (row[key] ?? 0) - op.decrement;
      else if ('multiply' in op) resolved[key] = (row[key] ?? 0) * op.multiply;
      else if ('set' in op) resolved[key] = op.set;
      else resolved[key] = value;
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

function applyNestedWrites(modelName: string, data: Row, db: Db, authAccountId: string) {
  for (const relationField of ['userProfile', 'adminProfile']) {
    const write = data[relationField];
    if (!write) continue;
    delete data[relationField];

    if (write.create) {
      db[relationField]!.push({ id: randomUUID(), authAccountId, createdAt: new Date(), updatedAt: new Date(), ...write.create });
    }
    if (write.upsert) {
      const existing = db[relationField]!.find((r) => r.authAccountId === authAccountId);
      if (existing) Object.assign(existing, write.upsert.update, { updatedAt: new Date() });
      else db[relationField]!.push({ id: randomUUID(), authAccountId, createdAt: new Date(), updatedAt: new Date(), ...write.upsert.create });
    }
  }
}

function createModel(db: Db, name: string) {
  const table = () => db[name]!;

  return {
    findUnique: async ({ where, include }: { where: Row; include?: Row }) => {
      const row = table().find((r) => matchesWhere(r, where, name, db));
      if (!row) return null;
      return include ? resolveInclude(clone(row), name, include, db) : clone(row);
    },
    findUniqueOrThrow: async (args: { where: Row; include?: Row }) => {
      const row = table().find((r) => matchesWhere(r, args.where, name, db));
      if (!row) throw new Error(`${name} not found for ${JSON.stringify(args.where)}`);
      return args.include ? resolveInclude(clone(row), name, args.include, db) : clone(row);
    },
    findFirst: async ({ where, orderBy, include }: { where?: Row; orderBy?: Row | Row[]; include?: Row }) => {
      let rows = table().filter((r) => matchesWhere(r, where, name, db));
      if (orderBy) rows = sortRows(rows, orderBy, name, db);
      const row = rows[0];
      if (!row) return null;
      return include ? resolveInclude(clone(row), name, include, db) : clone(row);
    },
    findMany: async ({
      where,
      orderBy,
      include,
      distinct,
      skip,
      take,
    }: {
      where?: Row; orderBy?: Row | Row[]; include?: Row; distinct?: string[]; skip?: number; take?: number;
    } = {}) => {
      let rows = table().filter((r) => matchesWhere(r, where, name, db));
      if (orderBy) rows = sortRows(rows, orderBy, name, db);
      if (distinct) {
        const seen = new Set<string>();
        rows = rows.filter((r) => {
          const key = distinct.map((f) => r[f]).join('|');
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
      if (skip) rows = rows.slice(skip);
      if (typeof take === 'number') rows = rows.slice(0, take);
      return rows.map((row) => (include ? resolveInclude(clone(row), name, include, db) : clone(row)));
    },
    create: async ({ data }: { data: Row }) => {
      const row: Row = withDefaults(name, { id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...data });
      applyNestedWrites(name, row, db, row.id);
      table().push(row);
      return clone(row);
    },
    createMany: async ({ data }: { data: Row[] }) => {
      const rows = data.map((d) => withDefaults(name, { id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...d }));
      table().push(...rows);
      return { count: rows.length };
    },
    upsert: async ({ where, update, create }: { where: Row; update: Row; create: Row }) => {
      const row = table().find((r) => matchesWhere(r, where, name, db));
      if (row) {
        Object.assign(row, resolveScalarOps(row, update), { updatedAt: new Date() });
        return clone(row);
      }
      const created: Row = withDefaults(name, { id: randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...create });
      applyNestedWrites(name, created, db, created.id);
      table().push(created);
      return clone(created);
    },
    aggregate: async ({
      where,
      _min,
      _max,
      _count,
      _sum,
    }: { where?: Row; _min?: Row; _max?: Row; _count?: Row | boolean; _sum?: Row } = {}) => {
      const rows = table().filter((r) => matchesWhere(r, where, name, db));
      const result: Row = {};
      if (_min) {
        result._min = {};
        for (const field of Object.keys(_min)) {
          result._min[field] = rows.length ? rows.reduce((min, r) => (r[field] < min ? r[field] : min), rows[0]![field]) : null;
        }
      }
      if (_max) {
        result._max = {};
        for (const field of Object.keys(_max)) {
          result._max[field] = rows.length ? rows.reduce((max, r) => (r[field] > max ? r[field] : max), rows[0]![field]) : null;
        }
      }
      if (_count) {
        if (_count === true) {
          result._count = rows.length;
        } else {
          result._count = {};
          for (const field of Object.keys(_count)) result._count[field] = rows.length;
        }
      }
      if (_sum) {
        result._sum = {};
        for (const field of Object.keys(_sum)) {
          result._sum[field] = rows.length ? rows.reduce((sum, r) => sum + (Number(r[field]) || 0), 0) : null;
        }
      }
      return result;
    },
    update: async ({ where, data }: { where: Row; data: Row }) => {
      const row = table().find((r) => matchesWhere(r, where, name, db));
      if (!row) throw new Error(`${name} not found for update: ${JSON.stringify(where)}`);
      const patch = resolveScalarOps(row, data);
      applyNestedWrites(name, patch, db, row.id);
      Object.assign(row, patch, { updatedAt: new Date() });
      return clone(row);
    },
    updateMany: async ({ where, data }: { where?: Row; data: Row }) => {
      const rows = table().filter((r) => matchesWhere(r, where, name, db));
      rows.forEach((row) => Object.assign(row, resolveScalarOps(row, data), { updatedAt: new Date() }));
      return { count: rows.length };
    },
    deleteMany: async ({ where }: { where?: Row } = {}) => {
      const toDelete = table().filter((r) => matchesWhere(r, where, name, db));
      db[name] = table().filter((r) => !matchesWhere(r, where, name, db));
      toDelete.forEach((row) => cascadeDelete(db, name, row.id));
      return { count: toDelete.length };
    },
    delete: async ({ where }: { where: Row }) => {
      const row = table().find((r) => matchesWhere(r, where, name, db));
      if (!row) throw new Error(`${name} not found for delete: ${JSON.stringify(where)}`);
      db[name] = table().filter((r) => r !== row);
      cascadeDelete(db, name, row.id);
      return clone(row);
    },
    count: async ({ where }: { where?: Row } = {}) => table().filter((r) => matchesWhere(r, where, name, db)).length,
  };
}

function compareByClause(a: Row, b: Row, clause: Row, modelName?: string, db?: Db): number {
  const [field, direction] = Object.entries(clause)[0] as [string, any];

  // Nested relation sort, e.g. `{ category: { onlinePrice: 'asc' } }` on Product.
  if (direction && typeof direction === 'object') {
    const relation = modelName && db ? RELATIONS[modelName]?.[field] : undefined;
    const [subField, subDirection] = Object.entries(direction)[0] as [string, 'asc' | 'desc'];
    const valueFor = (row: Row) =>
      relation && db ? (db[relation.table] ?? []).find((r) => r.id === row[relation.fk])?.[subField] : undefined;
    const av = valueFor(a);
    const bv = valueFor(b);
    const diff = av > bv ? 1 : av < bv ? -1 : 0;
    return subDirection === 'desc' ? -diff : diff;
  }

  const diff = a[field] > b[field] ? 1 : a[field] < b[field] ? -1 : 0;
  return direction === 'desc' ? -diff : diff;
}

// Prisma's orderBy is either one `{field: direction}` clause or an array of
// them for multi-key sorts, each clause acting as a tiebreaker for the last.
function sortRows(rows: Row[], orderBy: Row | Row[], modelName?: string, db?: Db): Row[] {
  const clauses = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const clause of clauses) {
      const diff = compareByClause(a, b, clause, modelName, db);
      if (diff !== 0) return diff;
    }
    return 0;
  });
}

export function createFakePrisma() {
  const db: Db = Object.fromEntries(MODELS.map((m) => [m, []])) as Db;

  const client: any = {};
  for (const model of MODELS) client[model] = createModel(db, model);

  // Interactive transactions roll back on throw, like the real thing —
  // otherwise a test can't tell "wrote nothing" apart from "wrote half of it
  // and then failed", which is exactly the guarantee several callers depend on
  // (product creation claiming its barcodes, checkout reserving stock).
  //
  // The snapshot restores both row membership and each row's fields, but
  // reuses the original row objects rather than cloning, so references handed
  // out by the seed helpers stay valid after a rollback.
  const snapshot = () =>
    Object.fromEntries(
      Object.entries(db).map(([model, rows]) => [model, (rows as any[]).map((row) => ({ row, fields: { ...row } }))])
    );

  const restore = (snap: Record<string, { row: any; fields: any }[]>) => {
    for (const [model, entries] of Object.entries(snap)) {
      for (const { row, fields } of entries) {
        for (const key of Object.keys(row)) if (!(key in fields)) delete row[key];
        Object.assign(row, fields);
      }
      (db as any)[model] = entries.map((e) => e.row);
    }
  };

  client.$transaction = async (arg: any) => {
    if (typeof arg !== 'function') return Promise.all(arg);
    const before = snapshot();
    try {
      return await arg(client);
    } catch (err) {
      restore(before);
      throw err;
    }
  };

  return { client, db };
}

export function seedCatalogFixture(db: Db) {
  const category = {
    id: randomUUID(), name: 'Kanjivaram Silk', slug: 'kanjivaram-silk', description: 'Silk sarees',
    imageUrl: '/images/categories/kanjivaram-silk.jpg', sortOrder: 1, isActive: true,
    createdAt: new Date(), updatedAt: new Date(),
  };
  db.category!.push(category);

  // Subcategory-level pricing: both fixture products share this subcategory,
  // and therefore the same price — see catalog.service.test.ts for how
  // price-filter/sort tests add a second, differently-priced subcategory.
  const subcategory = {
    id: randomUUID(), categoryId: category.id, name: 'Kanchi Border', description: 'Silk sarees with a Kanchi border',
    sortOrder: 0, isActive: true, onlinePrice: 12999, storePrice: 11999, mrp: 16999,
    createdAt: new Date(), updatedAt: new Date(),
  };
  db.subcategory!.push(subcategory);

  const products = [
    {
      id: randomUUID(), slug: 'rani-pink-kanjivaram', sku: 'NH-TEST-001', name: 'Rani Pink Kanjivaram Silk Saree',
      categoryId: category.id, subcategoryId: subcategory.id, technique: 'Butta', borderStyle: 'Kanchi Border',
      purity: 'Pure Pattu', zariTier: '300k', blouseType: 'Plain Blouse', pattern: 'Butta', color: 'Rani Pink',
      fabric: 'Pure Silk', occasion: ['Wedding', 'Festive'], stock: 5,
      channelVisibility: 'both', trackingMode: 'quantity',
      isFeatured: true, isActive: true, createdAt: new Date(), updatedAt: new Date(),
    },
    {
      id: randomUUID(), slug: 'magenta-plain-gold', sku: 'NH-TEST-002', name: 'Magenta Plain Silk Saree',
      categoryId: category.id, subcategoryId: subcategory.id, technique: 'Plain', borderStyle: 'Big Border',
      purity: 'Pure Pattu', zariTier: '350k', blouseType: 'Plain Blouse', pattern: 'Plain', color: 'Magenta',
      fabric: 'Pure Silk', occasion: ['Wedding'], stock: 1,
      channelVisibility: 'both', trackingMode: 'quantity',
      isFeatured: false, isActive: true, createdAt: new Date(), updatedAt: new Date(),
    },
  ];
  db.product!.push(...products);

  db.productImage!.push(
    { id: randomUUID(), productId: products[0]!.id, url: '/images/products/a.jpg', sortOrder: 0 },
    { id: randomUUID(), productId: products[1]!.id, url: '/images/products/b.jpg', sortOrder: 0 }
  );

  return { category, subcategory, products };
}

export function seedRoles(db: Db) {
  const roles = ['CUSTOMER', 'STAFF', 'ADMIN'].map((name) => ({
    id: randomUUID(),
    name,
    isSystem: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  db.role!.push(...roles);
  return Object.fromEntries(roles.map((r) => [r.name, r]));
}
