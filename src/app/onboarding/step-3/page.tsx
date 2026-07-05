import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions, subscriptionPlans } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { Step3Form } from "../_components/step-3-form";

export default async function OnboardingStep3Page({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const { tenant: tenantSlug } = await searchParams;
  if (!tenantSlug) redirect("/select-workspace");

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const authorized = await getAuthorizedTenantMembership(user.id, tenantSlug, [
    "President/School Owner",
  ]);
  if (!authorized) redirect("/select-workspace");

  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.tenantId, authorized.tenant.id),
  });

  const plan = subscription
    ? await db.query.subscriptionPlans.findFirst({ where: eq(subscriptionPlans.id, subscription.planId) })
    : null;

  const currentPlanName = (plan?.name ?? "Starter") as "Starter" | "Growth" | "Association";
  const trialEndLabel = subscription
    ? new Date(subscription.trialEnd).toLocaleDateString("en-NG", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";
  const trialDays = subscription
    ? Math.round(
        (new Date(subscription.trialEnd).getTime() - new Date(subscription.trialStart).getTime()) /
          (24 * 60 * 60 * 1000)
      )
    : 14;

  return (
    <Step3Form
      tenantSlug={tenantSlug}
      currentPlanName={currentPlanName}
      trialEndLabel={trialEndLabel}
      trialDays={trialDays}
    />
  );
}
