import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { getOrCreateActiveInvite, inviteUrl } from "@/lib/invites";
import { InviteLinkCard } from "@/components/invite-link-card";

export default async function AdminInvitePage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const authorized = await getAuthorizedTenantMembership(user.id, tenantSlug, [
    "President/School Owner",
    "Secretary",
  ]);
  if (!authorized) redirect(`/${tenantSlug}/admin`);

  const invite = await getOrCreateActiveInvite(authorized.tenant.id, user.id);

  return (
    <main className="flex-1 px-6 py-6">
      <h1 className="text-xl font-semibold text-neutral-900">Invite Link</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Share this private link so members can create accounts and join — without listing your school
        publicly.
      </p>

      <div className="mt-6 max-w-xl">
        <InviteLinkCard initialUrl={inviteUrl(invite.token)} tenantSlug={tenantSlug} />
      </div>
    </main>
  );
}
