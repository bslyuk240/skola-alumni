import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { env } from "@/config/env";
import * as schema from "./schema";

// neon-http (a single stateless fetch per query) doesn't support db.transaction(); this app relies on
// transactions (e.g. tenant onboarding, presidency handover), so we use the Pool-based driver instead.
// No explicit `webSocketConstructor` needed — Node 22's native `WebSocket` global is used automatically
// (the `ws` package's optional native bufferutil binary was broken on this Windows setup).

declare global {
  var __skolaPool: Pool | undefined;
}

// Reused across Next.js dev hot-reloads — otherwise every file save opens a new pooled connection
// without closing the old one.
const pool = global.__skolaPool ?? new Pool({ connectionString: env.DATABASE_URL });

if (process.env.NODE_ENV !== "production") {
  global.__skolaPool = pool;
}

export const db = drizzle(pool, { schema });
