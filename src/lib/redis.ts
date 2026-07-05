import Redis from "ioredis";
import { getRedisEnv } from "@/config/env";

declare global {
  var __skolaRedis: Redis | undefined;
}

/** Reused across hot reloads in dev to avoid exhausting connections. */
export const redis =
  global.__skolaRedis ??
  new Redis(getRedisEnv().REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy: (attempt) => Math.min(attempt * 200, 2000),
  });

if (process.env.NODE_ENV !== "production") {
  global.__skolaRedis = redis;
}

export const CACHE_TTL_SECONDS = 60 * 15; // 15-minute TTL per TRD caching strategy
