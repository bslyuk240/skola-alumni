import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions, subscriptionPlans, tenantMemberships } from "@/db/schema";
import { getPlatformSettings } from "@/lib/platform-settings";

export interface BillingLockStatus {
  locked: boolean;
  message: string | null;
}

/**
 * Tier enforcement per the blueprint: trial-expiry and over-member-limit lock immediately; an
 * ACTIVE subscription whose current period has lapsed gets a 3-day grace banner before locking.
 * Note: this checks `current_period_end` via simple date math rather than real Paystack recurring
 * "Subscriptions"/"Plans" webhooks (subscription.disable, invoice.payment_failed) — that requires
 * Paystack's separate recurring-billing API which is out of scope for this pass. Renewal today is
 * manual (President re-runs checkout), not auto-charged.
 */
export async function getBillingLockStatus(tenantId: string): Promise<BillingLockStatus> {
  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.tenantId, tenantId),
  });
  if (!subscription) return { locked: false, message: null };

  const now = new Date();

  if (subscription.status === "TRIALING" && now > subscription.trialEnd) {
    return {
      locked: true,
      message: "Your 14-day trial has ended. Upgrade to keep using Skola Alumni.",
    };
  }

  if (subscription.status === "ACTIVE") {
    const { gracePeriodDays } = await getPlatformSettings();
    const graceEnd = new Date(
      subscription.currentPeriodEnd.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000
    );

    if (now > graceEnd) {
      return {
        locked: true,
        message: "Your subscription payment is overdue. Renew to restore access.",
      };
    }

    if (now > subscription.currentPeriodEnd) {
      const daysLeft = Math.ceil((graceEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      return {
        locked: false,
        message: `Your billing period has ended — renew within ${daysLeft} day(s) to avoid losing access.`,
      };
    }
  }

  const plan = await db.query.subscriptionPlans.findFirst({
    where: eq(subscriptionPlans.id, subscription.planId),
  });

  if (plan) {
    const memberCount = await db.$count(
      tenantMemberships,
      and(eq(tenantMemberships.tenantId, tenantId), eq(tenantMemberships.status, "APPROVED"))
    );

    if (memberCount > plan.memberLimit) {
      return {
        locked: true,
        message: `You've exceeded your ${plan.name} plan's ${plan.memberLimit}-member limit. Upgrade to continue.`,
      };
    }
  }

  return { locked: false, message: null };
}
