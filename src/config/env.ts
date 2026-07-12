import { z } from "zod";

// Core vars are load-bearing for nearly every request (DB reads, auth), so they're validated eagerly
// at import time. Everything else validates lazily — only when that specific integration is actually
// used — so an unfilled Paystack/Cloudinary/Resend/Redis key doesn't 500 unrelated pages.
const coreSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required"),
  // Server-only twin of the above — clerkMiddleware's redirect/handshake logic reads this directly.
  CLERK_PUBLISHABLE_KEY: z.string().min(1, "CLERK_PUBLISHABLE_KEY is required"),
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
  NEXT_PUBLIC_APP_URL: z
    .string()
    .min(1)
    .transform((value) => {
      const trimmed = value.trim().replace(/\/$/, "");
      return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    })
    .pipe(z.string().url())
    .default("http://localhost:3000"),
});

export type CoreEnv = z.infer<typeof coreSchema>;

function loadCoreEnv(): CoreEnv {
  const parsed = coreSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error(
      "[env] Invalid or missing core environment variables:",
      parsed.error.flatten().fieldErrors
    );
    throw new Error("Invalid core environment configuration. Check .env.local against .env.example.");
  }

  return parsed.data;
}

export const env = loadCoreEnv();

function makeLazyEnv<Shape extends z.ZodRawShape>(integrationName: string, shape: Shape) {
  const schema = z.object(shape);
  let cached: z.infer<typeof schema> | null = null;

  return (): z.infer<typeof schema> => {
    if (cached) return cached;

    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      console.error(
        `[env] Invalid or missing ${integrationName} environment variables:`,
        parsed.error.flatten().fieldErrors
      );
      throw new Error(
        `Missing ${integrationName} environment configuration. Check .env.local against .env.example.`
      );
    }

    cached = parsed.data;
    return cached;
  };
}

export const getClerkWebhookEnv = makeLazyEnv("Clerk webhook", {
  CLERK_WEBHOOK_SECRET: z.string().min(1),
});

export const getRedisEnv = makeLazyEnv("Redis", {
  REDIS_URL: z.string().min(1),
});

export const getPaystackEnv = makeLazyEnv("Paystack", {
  // Paystack has no separate webhook-signing secret (unlike Stripe) — it signs webhooks with this
  // same secret key, so this one value covers both server-side API calls and webhook verification.
  PAYSTACK_SECRET_KEY: z.string().min(1),
  NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: z.string().min(1),
});

export const getCloudinaryEnv = makeLazyEnv("Cloudinary", {
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_SECRET: z.string().min(1),
});

// Lazy: only required when live-stream APIs run — empty values won't break the rest of the app.
// CUSTOMER_CODE is optional — WHIP/WHEP URLs come from the Stream API response.
export const getCloudflareStreamEnv = makeLazyEnv("Cloudflare Stream", {
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1),
  CLOUDFLARE_STREAM_API_TOKEN: z.string().min(1),
  CLOUDFLARE_STREAM_CUSTOMER_CODE: z.string().optional(),
});

export const getResendEnv = makeLazyEnv("Resend", {
  RESEND_API_KEY: z.string().min(1),
});

export const getFirebaseAdminEnv = makeLazyEnv("Firebase Admin (push notifications)", {
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().min(1),
});

// Monitoring / push — genuinely optional even when their integration code runs; no lazy throw needed.
export const optionalEnv = {
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  SENTRY_DSN: process.env.SENTRY_DSN,
  AXIOM_TOKEN: process.env.AXIOM_TOKEN,
  AXIOM_DATASET: process.env.AXIOM_DATASET,
  FIREBASE_SERVICE_ACCOUNT_JSON: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  NEXT_PUBLIC_FIREBASE_VAPID_KEY: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
};
