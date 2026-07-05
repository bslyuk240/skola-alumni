import { createElement } from "react";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { tenantMemberships, auditLogs, users, profiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { sendTransactionalEmail } from "@/lib/resend";
import { WelcomeEmail } from "@/templates/welcome-email";
import { env } from "@/config/env";
import { handleApiError } from "@/lib/api-error";

const VERIFIER_ROLES = ["President/School Owner", "Secretary"];

const verifySchema = z.object({ action: z.enum(["APPROVED", "REJECTED"]) });

/** Secretary/President approves or rejects a pending tenant membership request. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string; membershipId: string }> }
) {
  try {
    const { tenantSlug, membershipId } = await params;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Access Denied" }, { status: 401 });
    }

    const authorized = await getAuthorizedTenantMembership(user.id, tenantSlug, VERIFIER_ROLES);
    if (!authorized) {
      return NextResponse.json({ error: "Resource Not Found" }, { status: 404 });
    }

    const target = await db.query.tenantMemberships.findFirst({
      where: and(eq(tenantMemberships.id, membershipId), eq(tenantMemberships.tenantId, authorized.tenant.id)),
    });
    if (!target) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }
    if (target.status !== "PENDING") {
      return NextResponse.json({ error: "Membership is not awaiting verification" }, { status: 409 });
    }

    const body = verifySchema.parse(await req.json());

    await db.transaction(async (tx) => {
      await tx
        .update(tenantMemberships)
        .set({ status: body.action, approvedBy: user.id, approvedAt: new Date() })
        .where(eq(tenantMemberships.id, target.id));

      await tx.insert(auditLogs).values({
        tenantId: authorized.tenant.id,
        actorId: user.id,
        action: body.action === "APPROVED" ? "MEMBER_APPROVE" : "MEMBER_REJECT",
        entityType: "tenant_memberships",
        entityId: target.id,
        payload: { targetUserId: target.userId },
      });
    });

    if (body.action === "APPROVED") {
      // Best-effort welcome email — a Resend misconfiguration shouldn't block the approval itself.
      try {
        const [recipient, profile] = await Promise.all([
          db.query.users.findFirst({ where: eq(users.id, target.userId) }),
          db.query.profiles.findFirst({ where: eq(profiles.userId, target.userId) }),
        ]);

        if (recipient) {
          await sendTransactionalEmail({
            to: recipient.email,
            subject: `Welcome to ${authorized.tenant.name}`,
            react: createElement(WelcomeEmail, {
              recipientName: profile?.firstName ?? "there",
              tenantName: authorized.tenant.name,
              homeUrl: `${env.NEXT_PUBLIC_APP_URL}/${tenantSlug}/home`,
            }),
          });
        }
      } catch (emailError) {
        console.error("[email] Failed to send welcome email:", emailError);
      }
    }

    return NextResponse.json({ id: target.id, status: body.action });
  } catch (error) {
    return handleApiError(error);
  }
}
