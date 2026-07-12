import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { verifyPaystackTransaction } from "@/lib/paystack";
import { parsePaystackMetadata } from "@/lib/paystack-metadata";
import { applySubscriptionPayment } from "@/lib/apply-subscription-payment";

const VALID_PLANS = new Set(["Starter", "Growth", "Association"]);

/**
 * If this tenant has a pending checkout reference and Paystack says it succeeded,
 * apply the plan upgrade. Safe to call on billing page load / after return.
 */
export async function finalizePendingSubscriptionPayment(tenantId: string) {
  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.tenantId, tenantId),
  });

  const reference = subscription?.pendingPaystackReference;
  if (!reference) return null;

  const transaction = await verifyPaystackTransaction(reference);
  if (transaction.status !== "success") {
    return { status: "not_paid" as const, reference };
  }

  const metadata = parsePaystackMetadata(transaction.metadata);
  const planName =
    (metadata.planName && VALID_PLANS.has(metadata.planName) ? metadata.planName : null) ??
    subscription.pendingPlanName;
  const billingCycle =
    metadata.billingCycle ??
    (subscription.pendingBillingCycle === "MONTHLY" || subscription.pendingBillingCycle === "YEARLY"
      ? subscription.pendingBillingCycle
      : null);

  if (!planName || !VALID_PLANS.has(planName) || !billingCycle) {
    throw new Error("Pending payment is missing plan details.");
  }

  await applySubscriptionPayment({
    tenantId,
    planName,
    billingCycle,
    paystackReference: transaction.reference,
  });

  await db
    .update(subscriptions)
    .set({
      pendingPaystackReference: null,
      pendingPlanName: null,
      pendingBillingCycle: null,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.tenantId, tenantId));

  return { status: "activated" as const, planName, reference };
}

export async function savePendingCheckout(options: {
  tenantId: string;
  reference: string;
  planName: string;
  billingCycle: "MONTHLY" | "YEARLY";
}) {
  await db
    .update(subscriptions)
    .set({
      pendingPaystackReference: options.reference,
      pendingPlanName: options.planName,
      pendingBillingCycle: options.billingCycle,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.tenantId, options.tenantId));
}
