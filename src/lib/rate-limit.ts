/**
 * Fixed-window rate limiter backed by Redis. Fails OPEN (allows the request) if Redis is
 * unreachable or REDIS_URL isn't configured — this is spam protection, not a security boundary,
 * so a Redis outage or missing config shouldn't block the underlying feature entirely.
 *
 * `@/lib/redis` constructs its client (and validates REDIS_URL) at import time, so the import
 * itself is done inside this try/catch rather than at module scope — otherwise a missing
 * REDIS_URL would throw before this function's own error handling ever runs.
 */
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const { redis } = await import("@/lib/redis");
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
    return count <= limit;
  } catch (error) {
    console.error("[rate-limit] Redis unavailable, allowing request:", error);
    return true;
  }
}
