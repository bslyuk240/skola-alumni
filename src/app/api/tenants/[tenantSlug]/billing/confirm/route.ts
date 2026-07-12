import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { verifyPaystackTransaction } from "@/lib/paystack";
import { parsePaystackMetadata } from "@/lib/paystack-metadata";
import { applySubscriptionPayment } from "@/lib/apply-subscription-payment";
import { handleApiError } from "@/lib/api-error";

const confirmSchema = z.object({
  reference: z.string().min(3).max(200),
});

const VALID_PLANS = new Set(["Starter", "Growth", "Association"]);

/** Manually apply a successful Paystack charge by reference (recovery if callback was missed). */
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

    const authorized = await getAuthorizedTenantMembership(user.id, tenantSlug, [
      "President/School Owner",
    ]);
    if (!authorized) {
      return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    const body = confirmSchema.parse(await req.json());
    const transaction = await verifyPaystackTransaction(body.reference);

    if (transaction.status !== "success") {
      return NextResponse.json({ error: "Paystack reports this payment was not successful." }, { status: 400 });
    }

    const metadata = parsePaystackMetadata(transaction.metadata);
    const planName = metadata.planName;
    const billingCycle = metadata.billingCycle;

    if (!planName || !VALID_PLANS.has(planName) || !billingCycle) {
      return NextResponse.json(
        {
          error:
            "This payment has no plan metadata. Start a new checkout from Billing so the plan is attached.",
        },
        { status: 400 }
      );
    }

    if (metadata.tenantId && metadata.tenantId !== authorized.tenant.id) {
      return NextResponse.json({ error: "This payment belongs to a different workspace." }, { status: 400 });
    }

    const result = await applySubscriptionPayment({
      tenantId: authorized.tenant.id,
      planName,
      billingCycle,
      paystackReference: transaction.reference,
    });

    return NextResponse.json({
      planName,
      alreadyApplied: result.alreadyApplied,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
