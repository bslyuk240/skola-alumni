import Link from "next/link";
import { eq, and, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { tenants, donationCampaigns, donationContributions } from "@/db/schema";

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

export default async function DonationsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, tenantSlug) });
  if (!tenant) return null;

  // Group-scoped campaigns are managed and given to from the group's own page. Creating a
  // tenant-wide campaign happens in the admin section, not here.
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
    .where(and(eq(donationCampaigns.tenantId, tenant.id), isNull(donationCampaigns.groupId), eq(donationCampaigns.isActive, true)))
    .groupBy(donationCampaigns.id)
    .orderBy(donationCampaigns.createdAt);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 py-3">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Donations</h1>
        <p className="text-sm text-neutral-500">Support your alumni association&apos;s ongoing projects.</p>
      </div>

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
                  href={`/${tenantSlug}/donations/${campaign.id}`}
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
