import 'dotenv/config';
import { Queue, Worker, JobsOptions, type Processor } from 'bullmq';
import IORedis from 'ioredis';

const disabled = (process.env.DISABLE_QUEUE === '1' || process.env.DISABLE_QUEUE === 'true' || process.env.IMAGE_QUEUE_DISABLED === '1' || process.env.IMAGE_QUEUE_DISABLED === 'true');
const redisUrl = process.env.UPSTASH_REDIS_URL || '';
if (!redisUrl || disabled) {
  // eslint-disable-next-line no-console
  console.warn('[queue] Queue disabled (no Redis URL or DISABLE_QUEUE set)');
}

export const connection = (redisUrl && !disabled)
  ? new IORedis(redisUrl, {
      tls: redisUrl.startsWith('rediss://') ? {} : undefined,
      maxRetriesPerRequest: null,
      connectTimeout: 10_000,
      retryStrategy(times) {
        return Math.min(2000 * times, 10_000);
      },
    })
  : undefined;

export function isQueueConfigured() {
  return Boolean(connection);
}

export function createQueue(name: string) {
  if (!connection) throw new Error('Queue connection not configured');
  return new Queue(name, { connection });
}

export function createWorker<Data = any, Result = any, Name extends string = string>(
  name: Name,
  processor: Processor<Data, Result, Name>
) {
  if (!connection) throw new Error('Queue connection not configured');
  return new Worker<Data, Result, Name>(name, processor, { connection });
}

export type AddJobOptions = JobsOptions;
