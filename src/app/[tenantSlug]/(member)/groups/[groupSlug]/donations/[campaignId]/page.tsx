import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { donationCampaigns, donationContributions, profiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getTenantGroup, getApprovedGroupMembership, getAuthorizedGroupMembership } from "@/lib/group-access";
import { ContributeForm } from "../../../../donations/[campaignId]/_components/contribute-form";
import { VerifyContribution } from "../../../../donations/[campaignId]/_components/verify-contribution";

const GROUP_ADMIN_ROLES = ["GROUP_OWNER", "GROUP_ADMIN"];

const STATUS_STYLES: Record<string, string> = {
  CONFIRMED: "bg-success-100 text-success-700",
  PENDING_CONFIRMATION: "bg-warning-100 text-warning-700",
  REJECTED: "bg-error-100 text-error-700",
};

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

export default async function GroupCampaignDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; groupSlug: string; campaignId: string }>;
}) {
  const { tenantSlug, groupSlug, campaignId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const resolved = await getTenantGroup(tenantSlug, groupSlug);
  if (!resolved) redirect(`/${tenantSlug}/groups`);

  const isApprovedMember = Boolean(await getApprovedGroupMembership(user.id, resolved.group.id));
  if (!isApprovedMember) redirect(`/${tenantSlug}/groups/${groupSlug}/info`);

  const isGroupAdmin = Boolean(await getAuthorizedGroupMembership(user.id, resolved.group.id, GROUP_ADMIN_ROLES));

  const campaign = await db.query.donationCampaigns.findFirst({
    where: and(eq(donationCampaigns.id, campaignId), eq(donationCampaigns.groupId, resolved.group.id)),
  });
  if (!campaign) notFound();

  const rows = await db
    .select({
      id: donationContributions.id,
      amount: donationContributions.amount,
      status: donationContributions.status,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
    })
    .from(donationContributions)
    .innerJoin(profiles, eq(profiles.userId, donationContributions.donorId))
    .where(eq(donationContributions.campaignId, campaign.id))
    .orderBy(donationContributions.createdAt);

  const [{ raised }] = await db
    .select({
      raised: sql<string>`coalesce(sum(${donationContributions.amount}) filter (where ${donationContributions.status} = 'CONFIRMED'), 0)`,
    })
    .from(donationContributions)
    .where(eq(donationContributions.campaignId, campaign.id));

  const pending = rows.filter((row) => row.status === "PENDING_CONFIRMATION");
  const others = rows.filter((row) => row.status !== "PENDING_CONFIRMATION");
  const target = campaign.targetAmount ? Number(campaign.targetAmount) : null;
  const progress = target ? Math.min(100, Math.round((Number(raised) / target) * 100)) : null;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 py-3">
      <Link
        href={`/${tenantSlug}/groups/${groupSlug}/donations`}
        className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        Back to group donations
      </Link>

      <div className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
        <h1 className="text-lg font-semibold text-neutral-900">{campaign.title}</h1>
        {campaign.description && <p className="mt-1 text-sm text-neutral-700">{campaign.description}</p>}

        {target ? (
          <div className="mt-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full bg-primary-600" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              {formatNaira(Number(raised))} raised of {formatNaira(target)} goal
            </p>
          </div>
        ) : (
          <p className="mt-3 text-xs text-neutral-500">{formatNaira(Number(raised))} raised so far</p>
        )}
      </div>

      {campaign.isActive && (
        <div className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">Give to This Campaign</h2>
          <ContributeForm tenantSlug={tenantSlug} campaignId={campaign.id} />
        </div>
      )}

      {isGroupAdmin && (
        <div className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">Pending Review ({pending.length})</h2>
          {pending.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">No contributions awaiting review.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-4 divide-y divide-neutral-100">
              {pending.map((row) => (
                <li key={row.id} className="flex flex-col gap-2 pt-4 first:pt-0 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">
                      {row.firstName} {row.lastName}
                    </p>
                    <p className="text-xs text-neutral-500">{formatNaira(Number(row.amount))}</p>
                  </div>
                  <VerifyContribution tenantSlug={tenantSlug} contributionId={row.id} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {others.length > 0 && (
        <div className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">Contributors</h2>
          <ul className="mt-2 flex flex-col divide-y divide-neutral-100">
            {others.map((row) => (
              <li key={row.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm text-neutral-900">
                    {row.firstName} {row.lastName}
                  </p>
                  <p className="text-xs text-neutral-500">{formatNaira(Number(row.amount))}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[row.status]}`}>
                  {row.status.replace("_", " ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
