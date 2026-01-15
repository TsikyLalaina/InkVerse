"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connection = void 0;
exports.isQueueConfigured = isQueueConfigured;
exports.createQueue = createQueue;
exports.createWorker = createWorker;
require("dotenv/config");
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const disabled = (process.env.DISABLE_QUEUE === '1' || process.env.DISABLE_QUEUE === 'true' || process.env.IMAGE_QUEUE_DISABLED === '1' || process.env.IMAGE_QUEUE_DISABLED === 'true');
const redisUrl = process.env.UPSTASH_REDIS_URL || '';
if (!redisUrl || disabled) {
    // eslint-disable-next-line no-console
    console.warn('[queue] Queue disabled (no Redis URL or DISABLE_QUEUE set)');
}
exports.connection = (redisUrl && !disabled)
    ? new ioredis_1.default(redisUrl, {
        tls: redisUrl.startsWith('rediss://') ? {} : undefined,
        maxRetriesPerRequest: null,
        connectTimeout: 10000,
        retryStrategy(times) {
            return Math.min(2000 * times, 10000);
        },
    })
    : undefined;
function isQueueConfigured() {
    return Boolean(exports.connection);
}
function createQueue(name) {
    if (!exports.connection)
        throw new Error('Queue connection not configured');
    return new bullmq_1.Queue(name, { connection: exports.connection });
}
function createWorker(name, processor) {
    if (!exports.connection)
        throw new Error('Queue connection not configured');
    return new bullmq_1.Worker(name, processor, { connection: exports.connection });
}
//# sourceMappingURL=queue.js.map