import { getRedisEnv } from "@/config/env";

/**
 * BullMQ bundles its own ioredis version, so passing a shared `ioredis.Redis`
 * instance from the app's own ioredis dependency causes type/version conflicts.
 * Passing plain connection options instead lets BullMQ manage its own client.
 */
export function getBullMqConnectionOptions() {
  const url = new URL(getRedisEnv().REDIS_URL);

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: url.username || undefined,
    password: url.password || undefined,
    tls: url.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null as null,
  };
}
