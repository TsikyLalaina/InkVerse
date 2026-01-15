"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ override: true });
const client_1 = require("@prisma/client");
const logLevels = ['error', 'warn', 'info'];
let prisma;
if (process.env.NODE_ENV !== 'production') {
    if (!global.__prisma__) {
        global.__prisma__ = new client_1.PrismaClient({ log: logLevels });
    }
    exports.prisma = prisma = global.__prisma__;
}
else {
    exports.prisma = prisma = new client_1.PrismaClient({ log: logLevels });
}
async function initPrisma() {
    try {
        // Soft check to help catch wrong host
        const url = process.env.DATABASE_URL || '';
        if (url.includes('db.') && url.includes('supabase.co') && !url.includes('pooler')) {
            console.warn('[Prisma] DATABASE_URL looks like a direct host (db.*). Prefer the transaction pooler URL (aws-*-pooler..., port 6543).');
        }
        await prisma.$connect();
    }
    catch (err) {
        // Helpful error for DB connectivity (Supabase Postgres)
        const dbUrl = process.env.DATABASE_URL ? 'set' : 'missing';
        console.error('[Prisma] Failed to connect to database.');
        console.error(`[Prisma] DATABASE_URL is ${dbUrl}.`);
        console.error(err);
        process.exit(1);
    }
}
void initPrisma();
//# sourceMappingURL=prisma.js.map