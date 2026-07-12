import { cache } from "react";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * Resolves the Clerk session to our internal `users` row. Returns null if unauthenticated.
 *
 * Lazily syncs from Clerk's backend API if the row doesn't exist yet — the `user.created`
 * webhook (src/app/api/webhooks/clerk) may not have landed (e.g. no public tunnel configured
 * for Svix delivery in local dev), so callers can't rely on the webhook alone.
 *
 * Wrapped in React `cache()` so layout + page in the same request share one lookup.
 */
export const getCurrentUser = cache(async () => {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  const existing = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) });
  if (existing) return existing;

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(clerkId);
  const primaryEmail = clerkUser.emailAddresses.find(
    (address) => address.id === clerkUser.primaryEmailAddressId
  )?.emailAddress;

  if (!primaryEmail) return null;

  await db.insert(users).values({ clerkId, email: primaryEmail }).onConflictDoNothing({ target: users.clerkId });

  return (await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) })) ?? null;
});

/** Fetches a user's membership + status within a given tenant, scoped by internal user id. */
export async function getTenantMembership(userId: string, tenantId: string) {
  return db.query.tenantMemberships.findFirst({
    where: (membership, { and, eq }) =>
      and(eq(membership.userId, userId), eq(membership.tenantId, tenantId)),
  });
}
