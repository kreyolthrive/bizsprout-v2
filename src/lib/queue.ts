import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

export const connection = new IORedis(process.env.REDIS_URL!);

export const q = (name: string) => new Queue(name, { connection });
export const worker = (name: string, processor: Parameters<typeof Worker>[1]) =>
  new Worker(name, processor, { connection });
export const events = (name: string) => new QueueEvents(name, { connection });
