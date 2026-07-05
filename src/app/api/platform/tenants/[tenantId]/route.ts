import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenants, auditLogs } from "@/db/schema";
import { getPlatformAdminUser } from "@/lib/platform-access";
import { handleApiError } from "@/lib/api-error";

const updateTenantSchema = z.object({ isActive: z.boolean() });

/** Platform admin freezes (suspends) or unfreezes a tenant workspace. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const admin = await getPlatformAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    const { tenantId } = await params;
    const body = updateTenantSchema.parse(await req.json());

    const [updated] = await db
      .update(tenants)
      .set({ isActive: body.isActive })
      .where(eq(tenants.id, tenantId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    await db.insert(auditLogs).values({
      tenantId: updated.id,
      actorId: admin.id,
      action: body.isActive ? "TENANT_UNFREEZE" : "TENANT_FREEZE",
      entityType: "tenants",
      entityId: updated.id,
      payload: { platformAdminEmail: admin.email },
    });

    return NextResponse.json({ id: updated.id, isActive: updated.isActive });
  } catch (error) {
    return handleApiError(error);
  }
}
