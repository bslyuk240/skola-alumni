import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { handleApiError } from "@/lib/api-error";

const updateTenantSchema = z.object({
  logoUrl: z.string().url().optional(),
  bankDetails: z
    .object({
      bankName: z.string().min(1),
      accountNumber: z.string().min(1),
      accountName: z.string().min(1),
    })
    .optional(),
});

/** Onboarding wizard steps 1 (identity/logo) and 2 (bank details) update the tenant through here. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  try {
    const { tenantSlug } = await params;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Access Denied" }, { status: 401 });
    }

    const authorized = await getAuthorizedTenantMembership(user.id, tenantSlug, [
      "President/School Owner",
    ]);
    if (!authorized) {
      return NextResponse.json({ error: "Resource Not Found" }, { status: 404 });
    }

    const body = updateTenantSchema.parse(await req.json());

    const [updated] = await db
      .update(tenants)
      .set(body)
      .where(eq(tenants.id, authorized.tenant.id))
      .returning();

    return NextResponse.json({ id: updated.id, logoUrl: updated.logoUrl, bankDetails: updated.bankDetails });
  } catch (error) {
    return handleApiError(error);
  }
}
