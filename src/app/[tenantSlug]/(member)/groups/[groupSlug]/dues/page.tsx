import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { dues, payments } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getTenantGroup, getAuthorizedGroupMembership } from "@/lib/group-access";
import { CreateDueForm } from "../../../../admin/dues/_components/create-due-form";

const GROUP_ADMIN_ROLES = ["GROUP_OWNER", "GROUP_ADMIN"];

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

export default async function GroupDuesPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; groupSlug: string }>;
}) {
  const { tenantSlug, groupSlug } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const resolved = await getTenantGroup(tenantSlug, groupSlug);
  if (!resolved) redirect(`/${tenantSlug}/groups`);

  const groupMembership = await getAuthorizedGroupMembership(user.id, resolved.group.id, GROUP_ADMIN_ROLES);
  if (!groupMembership) redirect(`/${tenantSlug}/groups/${groupSlug}/info`);

  const groupDues = await db
    .select({
      id: dues.id,
      title: dues.title,
      amount: dues.amount,
      dueDate: dues.dueDate,
      totalCount: sql<number>`count(${payments.id})`.mapWith(Number),
      paidCount: sql<number>`count(${payments.id}) filter (where ${payments.status} = 'PAID')`.mapWith(Number),
      pendingCount: sql<number>`count(${payments.id}) filter (where ${payments.status} = 'PENDING_CONFIRMATION')`.mapWith(
        Number
      ),
    })
    .from(dues)
    .leftJoin(payments, eq(payments.dueId, dues.id))
    .where(and(eq(dues.tenantId, resolved.tenant.id), eq(dues.groupId, resolved.group.id)))
    .groupBy(dues.id)
    .orderBy(dues.dueDate);

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
        <h1 className="text-lg font-semibold text-neutral-900">{resolved.group.name} — Dues</h1>
        <p className="text-sm text-neutral-500">Create dues and reconcile payments for this group&apos;s members.</p>
      </div>

      <CreateDueForm tenantSlug={tenantSlug} groupId={resolved.group.id} />

      <div className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-neutral-900">Active Dues</h2>
        {groupDues.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No dues created yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-neutral-100">
            {groupDues.map((due) => (
              <li key={due.id} className="py-2.5">
                <Link
                  href={`/${tenantSlug}/groups/${groupSlug}/dues/${due.id}`}
                  className="flex items-center justify-between hover:underline"
                >
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{due.title}</p>
                    <p className="text-xs text-neutral-500">
                      {formatNaira(Number(due.amount))} · Due {new Date(due.dueDate).toLocaleDateString("en-NG")}
                    </p>
                  </div>
                  <div className="text-right text-xs text-neutral-500">
                    <p>
                      {due.paidCount}/{due.totalCount} paid
                    </p>
                    {due.pendingCount > 0 && (
                      <p className="font-medium text-warning-700">{due.pendingCount} pending review</p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
