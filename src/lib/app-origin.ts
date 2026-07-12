import type { NextRequest } from "next/server";
import { env } from "@/config/env";

/**
 * Resolves the public app origin for Paystack callback_url.
 * Prefer the browser Origin (so local checkout returns to local, prod to prod),
 * then forwarded headers, then NEXT_PUBLIC_APP_URL (with https:// normalized).
 */
export function resolveAppOrigin(req: NextRequest): string {
  const origin = req.headers.get("origin");
  if (origin && /^https?:\/\//i.test(origin)) {
    return origin.replace(/\/$/, "");
  }

  const forwardedHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    const isLocal = forwardedHost.includes("localhost") || forwardedHost.startsWith("127.");
    const proto = forwardedProto ?? (isLocal ? "http" : "https");
    return `${proto}://${forwardedHost}`.replace(/\/$/, "");
  }

  let base = env.NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(base)) {
    base = `https://${base}`;
  }
  return base;
}
