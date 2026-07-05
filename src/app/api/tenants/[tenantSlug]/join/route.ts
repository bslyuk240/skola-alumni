import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { tenants, tenantMemberships, profiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";

/** Member self-registration: creates a PENDING tenant_membership awaiting admin approval. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  try {
    const { tenantSlug } = await params;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Access Denied" }, { status: 401 });
    }

    const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, user.id) });
    if (!profile) {
      return NextResponse.json(
        { error: "Complete your profile before requesting to join a school" },
        { status: 400 }
      );
    }

    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, tenantSlug) });
    if (!tenant || !tenant.isActive) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const existingMembership = await db.query.tenantMemberships.findFirst({
      where: and(eq(tenantMemberships.tenantId, tenant.id), eq(tenantMemberships.userId, user.id)),
    });

    if (existingMembership) {
      return NextResponse.json(
        { id: existingMembership.id, status: existingMembership.status },
        { status: 200 }
      );
    }

    const [membership] = await db
      .insert(tenantMemberships)
      .values({ tenantId: tenant.id, userId: user.id, status: "PENDING" })
      .returning();

    return NextResponse.json({ id: membership.id, status: membership.status }, { status: 202 });
  } catch (error) {
    return handleApiError(error);
  }
}
