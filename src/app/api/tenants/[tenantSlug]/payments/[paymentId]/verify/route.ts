import { createElement } from "react";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { tenants, payments, dues, paymentReceipts, auditLogs, users, profiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { getAuthorizedGroupMembership } from "@/lib/group-access";
import { sendTransactionalEmail } from "@/lib/resend";
import { PaymentConfirmedEmail } from "@/templates/payment-confirmed-email";
import { env } from "@/config/env";
import { handleApiError } from "@/lib/api-error";

const FINANCE_ROLES = ["President/School Owner", "Finance Admin"];
const GROUP_ADMIN_ROLES = ["GROUP_OWNER", "GROUP_ADMIN"];

const verifySchema = z.object({
  action: z.enum(["APPROVED", "REJECTED"]),
  adminNotes: z.string().max(2000).optional(),
});

/**
 * Approves or rejects a pending payment. A payment against a group-scoped due is that group's
 * own affair — its owner/admin verifies it. Tenant-wide dues remain verified by tenant finance
 * roles. Records an audit log entry either way.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string; paymentId: string }> }
) {
  try {
    const { tenantSlug, paymentId } = await params;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Access Denied" }, { status: 401 });
    }

    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, tenantSlug) });
    if (!tenant || !tenant.isActive) {
      return NextResponse.json({ error: "Resource Not Found" }, { status: 404 });
    }

    const payment = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const due = await db.query.dues.findFirst({
      where: and(eq(dues.id, payment.dueId), eq(dues.tenantId, tenant.id)),
    });
    if (!due) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (due.groupId) {
      const groupMembership = await getAuthorizedGroupMembership(user.id, due.groupId, GROUP_ADMIN_ROLES);
      if (!groupMembership) {
        return NextResponse.json({ error: "Resource Not Found" }, { status: 404 });
      }
    } else {
      const authorized = await getAuthorizedTenantMembership(user.id, tenantSlug, FINANCE_ROLES);
      if (!authorized) {
        return NextResponse.json({ error: "Resource Not Found" }, { status: 404 });
      }
    }

    if (payment.status !== "PENDING_CONFIRMATION") {
      return NextResponse.json({ error: "Payment is not awaiting review" }, { status: 409 });
    }

    const body = verifySchema.parse(await req.json());
    const newStatus = body.action === "APPROVED" ? "PAID" : "REJECTED";

    const latestReceipt = await db.query.paymentReceipts.findFirst({
      where: eq(paymentReceipts.paymentId, payment.id),
      orderBy: desc(paymentReceipts.createdAt),
    });

    await db.transaction(async (tx) => {
      await tx
        .update(payments)
        .set({
          status: newStatus,
          amountPaid: newStatus === "PAID" ? due.amount : payment.amountPaid,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, payment.id));

      if (latestReceipt) {
        await tx
          .update(paymentReceipts)
          .set({ reviewedBy: user.id, reviewedAt: new Date(), adminNotes: body.adminNotes ?? latestReceipt.adminNotes })
          .where(eq(paymentReceipts.id, latestReceipt.id));
      }

      await tx.insert(auditLogs).values({
        tenantId: tenant.id,
        actorId: user.id,
        action: body.action === "APPROVED" ? "PAYMENT_APPROVE" : "PAYMENT_REJECT",
        entityType: "payments",
        entityId: payment.id,
        payload: { dueId: due.id, memberUserId: payment.userId, adminNotes: body.adminNotes },
      });
    });

    if (newStatus === "PAID") {
      // Best-effort confirmation email — a Resend misconfiguration shouldn't block the approval itself.
      try {
        const [recipient, profile] = await Promise.all([
          db.query.users.findFirst({ where: eq(users.id, payment.userId) }),
          db.query.profiles.findFirst({ where: eq(profiles.userId, payment.userId) }),
        ]);

        if (recipient) {
          await sendTransactionalEmail({
            to: recipient.email,
            subject: `Payment Confirmed — ${due.title}`,
            react: createElement(PaymentConfirmedEmail, {
              recipientName: profile?.firstName ?? "there",
              dueTitle: due.title,
              amount: `₦${Number(due.amount).toLocaleString("en-NG")}`,
              tenantName: tenant.name,
              duesUrl: `${env.NEXT_PUBLIC_APP_URL}/${tenantSlug}/dues`,
            }),
          });
        }
      } catch (emailError) {
        console.error("[email] Failed to send payment confirmation email:", emailError);
      }
    }

    return NextResponse.json({ id: payment.id, status: newStatus });
  } catch (error) {
    return handleApiError(error);
  }
}
