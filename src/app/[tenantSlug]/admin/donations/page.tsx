import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, and, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { donationCampaigns, donationContributions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { CreateCampaignForm } from "../../(member)/donations/_components/create-campaign-form";

const FINANCE_ROLES = ["President/School Owner", "Finance Admin"];

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

export default async function AdminDonationsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const authorized = await getAuthorizedTenantMembership(user.id, tenantSlug, FINANCE_ROLES);
  if (!authorized) redirect(`/${tenantSlug}/admin`);

  // Group-scoped campaigns are that group's own affair — created and verified from the group's
  // own page, not here. This page only handles tenant-wide campaigns.
  const campaigns = await db
    .select({
      id: donationCampaigns.id,
      title: donationCampaigns.title,
      targetAmount: donationCampaigns.targetAmount,
      pendingCount: sql<number>`count(${donationContributions.id}) filter (where ${donationContributions.status} = 'PENDING_CONFIRMATION')`.mapWith(
        Number
      ),
      raised: sql<string>`coalesce(sum(${donationContributions.amount}) filter (where ${donationContributions.status} = 'CONFIRMED'), 0)`,
    })
    .from(donationCampaigns)
    .leftJoin(donationContributions, eq(donationContributions.campaignId, donationCampaigns.id))
    .where(and(eq(donationCampaigns.tenantId, authorized.tenant.id), isNull(donationCampaigns.groupId)))
    .groupBy(donationCampaigns.id)
    .orderBy(donationCampaigns.createdAt);

  return (
    <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6">
      <h1 className="text-xl font-semibold text-neutral-900">Donations</h1>
      <p className="text-sm text-neutral-500">Create donation campaigns and review contributions.</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <CreateCampaignForm tenantSlug={tenantSlug} />

        <div className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">Campaigns</h2>
          {campaigns.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">No campaigns created yet.</p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-neutral-100">
              {campaigns.map((campaign) => {
                const raised = Number(campaign.raised);
                const target = campaign.targetAmount ? Number(campaign.targetAmount) : null;
                return (
                  <li key={campaign.id} className="py-2.5">
                    <Link
                      href={`/${tenantSlug}/admin/donations/${campaign.id}`}
                      className="flex items-center justify-between hover:underline"
                    >
                      <div>
                        <p className="text-sm font-medium text-neutral-900">{campaign.title}</p>
                        <p className="text-xs text-neutral-500">
                          {formatNaira(raised)} raised{target ? ` of ${formatNaira(target)} goal` : ""}
                        </p>
                      </div>
                      {campaign.pendingCount > 0 && (
                        <p className="text-xs font-medium text-warning-700">{campaign.pendingCount} pending review</p>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
