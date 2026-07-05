import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { tenants, groups, groupMemberships } from "@/db/schema";

/** Resolves a tenant + group pair by slug, or null if either doesn't exist / group is archived. */
export async function getTenantGroup(tenantSlug: string, groupSlug: string) {
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, tenantSlug) });
  if (!tenant || !tenant.isActive) return null;

  const group = await db.query.groups.findFirst({
    where: and(eq(groups.tenantId, tenant.id), eq(groups.slug, groupSlug)),
  });
  if (!group || group.isArchived) return null;

  return { tenant, group };
}

/** Verifies the user holds an APPROVED group membership with one of the allowed group roles. */
export async function getAuthorizedGroupMembership(
  userId: string,
  groupId: string,
  allowedGroupRoles: string[]
) {
  const membership = await db.query.groupMemberships.findFirst({
    where: and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.userId, userId)),
  });

  if (!membership || membership.status !== "APPROVED") return null;
  if (!allowedGroupRoles.includes(membership.groupRole)) return null;

  return membership;
}
