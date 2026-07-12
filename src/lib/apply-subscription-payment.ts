import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptionPlans, subscriptions } from "@/db/schema";

interface ApplyPaymentArgs {
  tenantId: string;
  planName: string;
  billingCycle: "MONTHLY" | "YEARLY";
  paystackReference: string;
}

/**
 * Activates a tenant's subscription after a successful Paystack charge. Idempotent by reference —
 * both the checkout callback page and the webhook call this, whichever fires first wins, and a
 * repeat call for the same reference is a harmless re-write of the same values.
 */
export async function applySubscriptionPayment({
  tenantId,
  planName,
  billingCycle,
  paystackReference,
}: ApplyPaymentArgs) {
  if (!tenantId) {
    throw new Error("Missing tenantId when applying subscription payment");
  }

  const plan = await db.query.subscriptionPlans.findFirst({
    where: eq(subscriptionPlans.name, planName),
  });
  if (!plan) throw new Error(`Unknown plan in Paystack metadata: ${planName}`);

  // Already applied this exact charge — leave current state alone.
  const existing = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.tenantId, tenantId),
  });
  if (existing?.paystackReference === paystackReference && existing.planId === plan.id) {
    return { subscriptionId: existing.id, alreadyApplied: true as const };
  }

  const now = new Date();
  const periodLengthMs =
    billingCycle === "YEARLY" ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
  const currentPeriodEnd = new Date(now.getTime() + periodLengthMs);

  const [updated] = await db
    .update(subscriptions)
    .set({
      planId: plan.id,
      status: "ACTIVE",
      billingCycle,
      currentPeriodStart: now,
      currentPeriodEnd,
      paystackReference,
      pendingPaystackReference: null,
      pendingPlanName: null,
      pendingBillingCycle: null,
      updatedAt: now,
    })
    .where(eq(subscriptions.tenantId, tenantId))
    .returning({ id: subscriptions.id });

  if (!updated) {
    throw new Error(`No subscription row found to update for tenant ${tenantId}`);
  }

  return { subscriptionId: updated.id, alreadyApplied: false as const };
}
