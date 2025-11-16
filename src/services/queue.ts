import 'dotenv/config';
import { Queue, Worker, JobsOptions, type Processor } from 'bullmq';
import IORedis from 'ioredis';

const redisUrl = process.env.UPSTASH_REDIS_URL || '';
if (!redisUrl) {
  // eslint-disable-next-line no-console
  console.warn('[queue] UPSTASH_REDIS_URL not set; queueing disabled');
}

export const connection = redisUrl
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
