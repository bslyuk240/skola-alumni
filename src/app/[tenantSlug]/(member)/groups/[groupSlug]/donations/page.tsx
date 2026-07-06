import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { donationCampaigns, donationContributions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getTenantGroup, getApprovedGroupMembership, getAuthorizedGroupMembership } from "@/lib/group-access";
import { CreateCampaignForm } from "../../../donations/_components/create-campaign-form";

const GROUP_ADMIN_ROLES = ["GROUP_OWNER", "GROUP_ADMIN"];

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

export default async function GroupDonationsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; groupSlug: string }>;
}) {
  const { tenantSlug, groupSlug } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const resolved = await getTenantGroup(tenantSlug, groupSlug);
  if (!resolved) redirect(`/${tenantSlug}/groups`);

  const isApprovedMember = Boolean(await getApprovedGroupMembership(user.id, resolved.group.id));
  if (!isApprovedMember) redirect(`/${tenantSlug}/groups/${groupSlug}/info`);

  const isGroupAdmin = Boolean(await getAuthorizedGroupMembership(user.id, resolved.group.id, GROUP_ADMIN_ROLES));

  const campaigns = await db
    .select({
      id: donationCampaigns.id,
      title: donationCampaigns.title,
      description: donationCampaigns.description,
      targetAmount: donationCampaigns.targetAmount,
      raised: sql<string>`coalesce(sum(${donationContributions.amount}) filter (where ${donationContributions.status} = 'CONFIRMED'), 0)`,
    })
    .from(donationCampaigns)
    .leftJoin(donationContributions, eq(donationContributions.campaignId, donationCampaigns.id))
    .where(and(eq(donationCampaigns.groupId, resolved.group.id), eq(donationCampaigns.isActive, true)))
    .groupBy(donationCampaigns.id)
    .orderBy(donationCampaigns.createdAt);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 py-3">
      <Link
        href={`/${tenantSlug}/groups/${groupSlug}/info`}
        className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        Back to group info
      </Link>

      <div>
        <h1 className="text-lg font-semibold text-neutral-900">{resolved.group.name} — Donations</h1>
        <p className="text-sm text-neutral-500">Support this group&apos;s own projects.</p>
      </div>

      {isGroupAdmin && <CreateCampaignForm tenantSlug={tenantSlug} groupId={resolved.group.id} />}

      {campaigns.length === 0 ? (
        <div className="rounded-lg border border-neutral-100 bg-white p-6 text-center shadow-sm">
          <h2 className="text-base font-semibold text-neutral-900">No Active Campaigns</h2>
          <p className="mt-1 text-sm text-neutral-700">There&apos;s nothing to give towards right now.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {campaigns.map((campaign) => {
            const raised = Number(campaign.raised);
            const target = campaign.targetAmount ? Number(campaign.targetAmount) : null;
            const progress = target ? Math.min(100, Math.round((raised / target) * 100)) : null;

            return (
              <li key={campaign.id}>
                <Link
                  href={`/${tenantSlug}/groups/${groupSlug}/donations/${campaign.id}`}
                  className="flex flex-col gap-2 rounded-lg border border-neutral-100 bg-white p-4 shadow-sm hover:border-neutral-500"
                >
                  <p className="text-sm font-semibold text-neutral-900">{campaign.title}</p>
                  {campaign.description && <p className="text-xs text-neutral-500">{campaign.description}</p>}

                  {target ? (
                    <>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                        <div className="h-full bg-primary-600" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="text-xs text-neutral-500">
                        {formatNaira(raised)} raised of {formatNaira(target)} goal
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-neutral-500">{formatNaira(raised)} raised so far</p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
