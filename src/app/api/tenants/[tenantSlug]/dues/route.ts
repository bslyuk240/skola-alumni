import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { dues, payments, tenantMemberships, groupMemberships, groups } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { getBillingLockStatus } from "@/lib/billing-status";
import { sendPushToUsers } from "@/lib/firebase-admin";
import { handleApiError } from "@/lib/api-error";

const FINANCE_ROLES = ["President/School Owner", "Finance Admin"];

const createDueSchema = z.object({
  title: z.string().min(1).max(255),
  amount: z.number().positive(),
  dueDate: z.string().min(1),
  isMandatory: z.boolean().default(true),
  groupId: z.string().uuid().optional(),
});

/** Creates a due and pre-populates an UNPAID payment row for every currently-applicable member. */
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

    const authorized = await getAuthorizedTenantMembership(user.id, tenantSlug, FINANCE_ROLES);
    if (!authorized) {
      return NextResponse.json({ error: "Resource Not Found" }, { status: 404 });
    }

    const lockStatus = await getBillingLockStatus(authorized.tenant.id);
    if (lockStatus.locked) {
      return NextResponse.json({ error: lockStatus.message }, { status: 402 });
    }

    const body = createDueSchema.parse(await req.json());

    if (body.groupId) {
      const group = await db.query.groups.findFirst({
        where: and(eq(groups.id, body.groupId), eq(groups.tenantId, authorized.tenant.id)),
      });
      if (!group) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
      }
    }

    const targetUserIds = body.groupId
      ? (
          await db
            .select({ userId: groupMemberships.userId })
            .from(groupMemberships)
            .where(and(eq(groupMemberships.groupId, body.groupId), eq(groupMemberships.status, "APPROVED")))
        ).map((row) => row.userId)
      : (
          await db
            .select({ userId: tenantMemberships.userId })
            .from(tenantMemberships)
            .where(
              and(eq(tenantMemberships.tenantId, authorized.tenant.id), eq(tenantMemberships.status, "APPROVED"))
            )
        ).map((row) => row.userId);

    const result = await db.transaction(async (tx) => {
      const [due] = await tx
        .insert(dues)
        .values({
          tenantId: authorized.tenant.id,
          groupId: body.groupId,
          title: body.title,
          amount: body.amount.toFixed(2),
          dueDate: new Date(body.dueDate),
          isMandatory: body.isMandatory,
          createdBy: user.id,
        })
        .returning();

      if (targetUserIds.length > 0) {
        await tx.insert(payments).values(
          targetUserIds.map((userId) => ({ dueId: due.id, userId, status: "UNPAID" as const }))
        );
      }

      return due;
    });

    // Best-effort push notification — a Firebase misconfiguration shouldn't block due creation.
    try {
      await sendPushToUsers(targetUserIds, {
        title: "💰 New Due Published",
        body: `${body.title} — ₦${body.amount.toLocaleString("en-NG")}`,
        link: `/${tenantSlug}/dues/${result.id}`,
      });
    } catch (pushError) {
      console.error("[push] Failed to send due notification:", pushError);
    }

    return NextResponse.json({ id: result.id, memberCount: targetUserIds.length }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
