import Link from "next/link";
import { eq, and, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { tenants, payments, dues, groups, groupMemberships, donationCampaigns, donationContributions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

const STATUS_STYLES: Record<string, string> = {
  PAID: "bg-success-100 text-success-700",
  PENDING_CONFIRMATION: "bg-warning-100 text-warning-700",
  REJECTED: "bg-error-100 text-error-700",
  UNPAID: "bg-error-100 text-error-700",
};

const STATUS_LABELS: Record<string, string> = {
  PAID: "Paid",
  PENDING_CONFIRMATION: "Pending",
  REJECTED: "Rejected",
  UNPAID: "Overdue",
};

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

function SourceBadge({ groupName }: { groupName: string | null }) {
  return (
    <span className="w-fit rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
      {groupName ?? "General"}
    </span>
  );
}

export default async function MemberDuesPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, tenantSlug) });
  if (!tenant) return null;

  const user = await getCurrentUser();
  if (!user) return null;

  const myGroups = await db
    .select({ groupId: groupMemberships.groupId })
    .from(groupMemberships)
    .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
    .where(
      and(eq(groupMemberships.userId, user.id), eq(groupMemberships.status, "APPROVED"), eq(groups.tenantId, tenant.id))
    );
  const myGroupIds = myGroups.map((row) => row.groupId);

  // Includes both tenant-wide and group-scoped dues (a payment row exists for every group this
  // member belongs to that has one) — groupName/groupSlug says where each one came from.
  const myDues = await db
    .select({
      dueId: dues.id,
      title: dues.title,
      amount: dues.amount,
      dueDate: dues.dueDate,
      status: payments.status,
      groupName: groups.name,
    })
    .from(payments)
    .innerJoin(dues, eq(dues.id, payments.dueId))
    .leftJoin(groups, eq(groups.id, dues.groupId))
    .where(and(eq(dues.tenantId, tenant.id), eq(payments.userId, user.id)))
    .orderBy(dues.dueDate);

  // Active campaigns this member can give to: tenant-wide ones, plus any run by a group they
  // belong to.
  const campaignScope =
    myGroupIds.length > 0
      ? or(isNull(donationCampaigns.groupId), inArray(donationCampaigns.groupId, myGroupIds))
      : isNull(donationCampaigns.groupId);

  const myCampaigns = await db
    .select({
      id: donationCampaigns.id,
      title: donationCampaigns.title,
      targetAmount: donationCampaigns.targetAmount,
      groupName: groups.name,
      groupSlug: groups.slug,
      raised: sql<string>`coalesce(sum(${donationContributions.amount}) filter (where ${donationContributions.status} = 'CONFIRMED'), 0)`,
    })
    .from(donationCampaigns)
    .leftJoin(groups, eq(groups.id, donationCampaigns.groupId))
    .leftJoin(donationContributions, eq(donationContributions.campaignId, donationCampaigns.id))
    .where(and(eq(donationCampaigns.tenantId, tenant.id), eq(donationCampaigns.isActive, true), campaignScope))
    .groupBy(donationCampaigns.id, groups.name, groups.slug)
    .orderBy(donationCampaigns.createdAt);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-3">
      <h1 className="text-lg font-semibold text-neutral-900">Dues &amp; Donations</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-neutral-900">Dues</h2>
        {myDues.length === 0 ? (
          <div className="rounded-lg border border-neutral-100 bg-white p-6 text-center shadow-sm">
            <h3 className="text-base font-semibold text-neutral-900">No Outstanding Dues</h3>
            <p className="mt-1 text-sm text-neutral-700">
              You have no dues from your association or any group you belong to right now.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {myDues.map((due) => (
              <li key={due.dueId}>
                <Link
                  href={`/${tenantSlug}/dues/${due.dueId}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-neutral-100 bg-white p-4 shadow-sm hover:border-neutral-500"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-neutral-900">{due.title}</p>
                      <SourceBadge groupName={due.groupName} />
                    </div>
                    <p className="text-xs text-neutral-500">
                      {formatNaira(Number(due.amount))} · Due {new Date(due.dueDate).toLocaleDateString("en-NG")}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[due.status]}`}>
                    {STATUS_LABELS[due.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-neutral-900">Donations</h2>
        {myCampaigns.length === 0 ? (
          <div className="rounded-lg border border-neutral-100 bg-white p-6 text-center shadow-sm">
            <h3 className="text-base font-semibold text-neutral-900">No Active Campaigns</h3>
            <p className="mt-1 text-sm text-neutral-700">
              There&apos;s nothing to give towards from your association or groups right now.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {myCampaigns.map((campaign) => {
              const raised = Number(campaign.raised);
              const target = campaign.targetAmount ? Number(campaign.targetAmount) : null;
              const progress = target ? Math.min(100, Math.round((raised / target) * 100)) : null;
              const href = campaign.groupSlug
                ? `/${tenantSlug}/groups/${campaign.groupSlug}/donations/${campaign.id}`
                : `/${tenantSlug}/donations/${campaign.id}`;

              return (
                <li key={campaign.id}>
                  <Link
                    href={href}
                    className="flex flex-col gap-2 rounded-lg border border-neutral-100 bg-white p-4 shadow-sm hover:border-neutral-500"
                  >
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-neutral-900">{campaign.title}</p>
                      <SourceBadge groupName={campaign.groupName} />
                    </div>

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
      </section>
    </main>
  );
}
