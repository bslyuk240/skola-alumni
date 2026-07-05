import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { dues, auditLogs } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";

const AUTHORIZED_ROLE_NAMES = ["President/School Owner", "Finance Admin"];

/**
 * Direct-attachment export (one of the two patterns the TRD endorses — the other being a signed
 * short-lived URL, which would need standing up temporary storage for a CSV this cheap to regenerate
 * per-request; not worth the extra moving part here).
 */
export async function GET(req: NextRequest) {
  // 1. Session Enforcement
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Access Denied" }, { status: 401 });
  }

  // 2. Request and Context Validation
  const tenantSlug = req.nextUrl.searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "Invalid Parameter Scope" }, { status: 400 });
  }

  // 3. User Authorization Check (shared helper — same tenant + role scoping used everywhere else)
  const authorized = await getAuthorizedTenantMembership(user.id, tenantSlug, AUTHORIZED_ROLE_NAMES);
  if (!authorized) {
    // Return standard error to prevent route sniffing
    return NextResponse.json({ error: "Resource Not Found" }, { status: 404 });
  }

  // 4. Record Audit Log Transaction
  await db.insert(auditLogs).values({
    tenantId: authorized.tenant.id,
    actorId: user.id,
    action: "EXPORT_FINANCIAL_DUES",
    entityType: "dues",
    entityId: authorized.tenant.id,
    payload: { userAgent: req.headers.get("user-agent") },
    // x-forwarded-for can be a comma-separated proxy chain — the first entry is the original client.
    ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  // 5. Build payload from active dues for this tenant
  const activeDues = await db.select().from(dues).where(eq(dues.tenantId, authorized.tenant.id));
  const csvHeader = "id,title,amount,due_date\n";
  const csvRows = activeDues
    .map((due) => `${due.id},"${due.title}",${due.amount},${due.dueDate.toISOString()}`)
    .join("\n");

  return new NextResponse(csvHeader + csvRows, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="dues-export-${Date.now()}.csv"`,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
