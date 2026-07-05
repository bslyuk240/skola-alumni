import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { dues, payments, paymentReceipts } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getApprovedTenantMembership } from "@/lib/tenant-access";
import { handleApiError } from "@/lib/api-error";

const submitReceiptSchema = z.object({
  receiptUrl: z.string().url(),
  transactionDate: z.string().min(1),
  senderReference: z.string().max(255).optional(),
});

/** Member submits proof-of-payment for a due; moves the payment to PENDING_CONFIRMATION. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string; dueId: string }> }
) {
  try {
    const { tenantSlug, dueId } = await params;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Access Denied" }, { status: 401 });
    }

    const authorized = await getApprovedTenantMembership(user.id, tenantSlug);
    if (!authorized) {
      return NextResponse.json({ error: "Resource Not Found" }, { status: 404 });
    }

    const due = await db.query.dues.findFirst({
      where: and(eq(dues.id, dueId), eq(dues.tenantId, authorized.tenant.id)),
    });
    if (!due) {
      return NextResponse.json({ error: "Due not found" }, { status: 404 });
    }

    const payment = await db.query.payments.findFirst({
      where: and(eq(payments.dueId, due.id), eq(payments.userId, user.id)),
    });
    if (!payment) {
      return NextResponse.json({ error: "This due does not apply to you" }, { status: 404 });
    }
    if (payment.status === "PENDING_CONFIRMATION" || payment.status === "PAID") {
      return NextResponse.json({ error: "A receipt is already under review or approved" }, { status: 409 });
    }

    const body = submitReceiptSchema.parse(await req.json());

    await db.transaction(async (tx) => {
      await tx
        .update(payments)
        .set({ status: "PENDING_CONFIRMATION", updatedAt: new Date() })
        .where(eq(payments.id, payment.id));

      await tx.insert(paymentReceipts).values({
        paymentId: payment.id,
        uploadedBy: user.id,
        receiptUrl: body.receiptUrl,
        transactionDate: new Date(body.transactionDate),
        adminNotes: body.senderReference ? `Sender reference: ${body.senderReference}` : undefined,
      });
    });

    return NextResponse.json({ status: "PENDING_CONFIRMATION" });
  } catch (error) {
    return handleApiError(error);
  }
}
