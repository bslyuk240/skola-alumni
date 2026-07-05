import Link from "next/link";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { tenants, payments, dues } from "@/db/schema";
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

  const myDues = await db
    .select({
      dueId: dues.id,
      title: dues.title,
      amount: dues.amount,
      dueDate: dues.dueDate,
      status: payments.status,
    })
    .from(payments)
    .innerJoin(dues, eq(dues.id, payments.dueId))
    .where(and(eq(dues.tenantId, tenant.id), eq(payments.userId, user.id)))
    .orderBy(dues.dueDate);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 py-3">
      <h1 className="text-lg font-semibold text-neutral-900">Dues Hub</h1>

      {myDues.length === 0 ? (
        <div className="rounded-lg border border-neutral-100 bg-white p-6 text-center shadow-sm">
          <h2 className="text-base font-semibold text-neutral-900">No Outstanding Dues</h2>
          <p className="mt-1 text-sm text-neutral-700">
            Your profile has no pending financial dues. Any future dues assigned by administrators will
            appear here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {myDues.map((due) => (
            <li key={due.dueId}>
              <Link
                href={`/${tenantSlug}/dues/${due.dueId}`}
                className="flex items-center justify-between rounded-lg border border-neutral-100 bg-white p-4 shadow-sm hover:border-neutral-500"
              >
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{due.title}</p>
                  <p className="text-xs text-neutral-500">
                    {formatNaira(Number(due.amount))} · Due {new Date(due.dueDate).toLocaleDateString("en-NG")}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[due.status]}`}>
                  {STATUS_LABELS[due.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
