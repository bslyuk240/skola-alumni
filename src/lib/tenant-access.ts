import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { tenants, tenantMemberships, roleAssignments, systemRoles } from "@/db/schema";

/**
 * Verifies the user holds an APPROVED membership in the given tenant with one of the allowed
 * system roles. Returns null (not a 403/404 — callers decide how to respond) if any check fails.
 */
export async function getAuthorizedTenantMembership(
  userId: string,
  tenantSlug: string,
  allowedRoleNames: string[]
) {
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, tenantSlug) });
  if (!tenant || !tenant.isActive) return null;

  const membership = await db.query.tenantMemberships.findFirst({
    where: and(eq(tenantMemberships.tenantId, tenant.id), eq(tenantMemberships.userId, userId)),
  });
  if (!membership || membership.status !== "APPROVED") return null;

  const roles = await db
    .select({ name: systemRoles.name })
    .from(roleAssignments)
    .innerJoin(systemRoles, eq(roleAssignments.systemRoleId, systemRoles.id))
    .where(
      and(
        eq(roleAssignments.tenantMembershipId, membership.id),
        inArray(systemRoles.name, allowedRoleNames)
      )
    );

  if (roles.length === 0) return null;

  return { tenant, membership };
}

/** Verifies the user holds an APPROVED membership in the tenant, regardless of system role. */
export async function getApprovedTenantMembership(userId: string, tenantSlug: string) {
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, tenantSlug) });
  if (!tenant || !tenant.isActive) return null;

  const membership = await db.query.tenantMemberships.findFirst({
    where: and(eq(tenantMemberships.tenantId, tenant.id), eq(tenantMemberships.userId, userId)),
  });
  if (!membership || membership.status !== "APPROVED") return null;

  return { tenant, membership };
}
