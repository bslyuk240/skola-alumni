import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { Step1Form } from "../_components/step-1-form";

export default async function OnboardingStep1Page({
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

  return <Step1Form tenantSlug={tenantSlug} currentLogoUrl={authorized.tenant.logoUrl} />;
}
