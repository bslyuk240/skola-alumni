import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { Step2Form } from "../_components/step-2-form";

interface BankDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export default async function OnboardingStep2Page({
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

  return (
    <Step2Form
      tenantSlug={tenantSlug}
      currentBankDetails={(authorized.tenant.bankDetails as BankDetails | null) ?? null}
    />
  );
}
