"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
// Passing { connectionString } directly to PrismaPg leaves the pool's
// user/password unset in @prisma/adapter-pg 7.x; wrapping it in a real pg.Pool
// is what actually threads the credentials through SASL auth.
const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new adapter_pg_1.PrismaPg(pool);
exports.prisma = new client_1.PrismaClient({ adapter });
//# sourceMappingURL=prisma.js.map