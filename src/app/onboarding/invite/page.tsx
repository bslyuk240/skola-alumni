import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { getOrCreateActiveInvite, inviteUrl } from "@/lib/invites";
import { InviteLinkCard } from "@/components/invite-link-card";
import { OnboardingShell } from "../_components/onboarding-shell";

export default async function OnboardingInvitePage({
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

  const invite = await getOrCreateActiveInvite(authorized.tenant.id, user.id);

  return (
    <OnboardingShell
      step={4}
      eyebrow="Workspace Setup"
      title="Invite your members"
      subtitle="Copy this link and paste it in your association WhatsApp group. Only people with the link can join — your school stays private."
    >
      <InviteLinkCard initialUrl={inviteUrl(invite.token)} tenantSlug={tenantSlug} />

      <div className="mt-6">
        <Link
          href={`/${tenantSlug}/admin`}
          className="flex w-full items-center justify-center rounded-md bg-primary-600 px-4 py-3.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
        >
          Go to Dashboard
        </Link>
      </div>
    </OnboardingShell>
  );
}
