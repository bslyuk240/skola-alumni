import { randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { tenantInvites, tenants } from "@/db/schema";
import { env } from "@/config/env";

export function generateInviteToken() {
  return randomBytes(18).toString("base64url");
}

export function inviteUrl(token: string) {
  return `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/invite/${token}`;
}

/** Creates a fresh active invite for a tenant (does not revoke existing ones). */
export async function createTenantInvite(tenantId: string, createdBy: string | null) {
  const [invite] = await db
    .insert(tenantInvites)
    .values({
      tenantId,
      token: generateInviteToken(),
      createdBy,
      isActive: true,
    })
    .returning();

  return invite;
}

/** Returns the active invite, creating one if the tenant has none yet. */
export async function getOrCreateActiveInvite(tenantId: string, createdBy: string | null) {
  const existing = await db.query.tenantInvites.findFirst({
    where: and(eq(tenantInvites.tenantId, tenantId), eq(tenantInvites.isActive, true)),
  });
  if (existing) return existing;
  return createTenantInvite(tenantId, createdBy);
}

/** Revokes all active invites and issues a new one. */
export async function regenerateTenantInvite(tenantId: string, createdBy: string | null) {
  const now = new Date();

  return db.transaction(async (tx) => {
    await tx
      .update(tenantInvites)
      .set({ isActive: false, revokedAt: now })
      .where(and(eq(tenantInvites.tenantId, tenantId), eq(tenantInvites.isActive, true)));

    const [invite] = await tx
      .insert(tenantInvites)
      .values({
        tenantId,
        token: generateInviteToken(),
        createdBy,
        isActive: true,
      })
      .returning();

    return invite;
  });
}

export async function getActiveInviteByToken(token: string) {
  const invite = await db.query.tenantInvites.findFirst({
    where: and(eq(tenantInvites.token, token), eq(tenantInvites.isActive, true)),
  });
  if (!invite) return null;

  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, invite.tenantId) });
  if (!tenant || !tenant.isActive) return null;

  return { invite, tenant };
}
