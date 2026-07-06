import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { eq, and, inArray, desc } from "drizzle-orm";
import { db } from "@/db";
import { dues, payments, profiles, paymentReceipts } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getTenantGroup, getAuthorizedGroupMembership } from "@/lib/group-access";
import { VerifyPayment } from "../../../../../admin/dues/[dueId]/_components/verify-payment";

const GROUP_ADMIN_ROLES = ["GROUP_OWNER", "GROUP_ADMIN"];

const STATUS_STYLES: Record<string, string> = {
  PAID: "bg-success-100 text-success-700",
  PENDING_CONFIRMATION: "bg-warning-100 text-warning-700",
  REJECTED: "bg-error-100 text-error-700",
  UNPAID: "bg-neutral-100 text-neutral-700",
};

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

export default async function GroupDueDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; groupSlug: string; dueId: string }>;
}) {
  const { tenantSlug, groupSlug, dueId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const resolved = await getTenantGroup(tenantSlug, groupSlug);
  if (!resolved) redirect(`/${tenantSlug}/groups`);

  const groupMembership = await getAuthorizedGroupMembership(user.id, resolved.group.id, GROUP_ADMIN_ROLES);
  if (!groupMembership) redirect(`/${tenantSlug}/groups/${groupSlug}/info`);

  const due = await db.query.dues.findFirst({
    where: and(eq(dues.id, dueId), eq(dues.tenantId, resolved.tenant.id), eq(dues.groupId, resolved.group.id)),
  });
  if (!due) notFound();

  const rows = await db
    .select({
      paymentId: payments.id,
      status: payments.status,
      userId: payments.userId,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
    })
    .from(payments)
    .innerJoin(profiles, eq(profiles.userId, payments.userId))
    .where(eq(payments.dueId, due.id));

  const paymentIds = rows.map((row) => row.paymentId);

  const receipts = paymentIds.length
    ? await db
        .select({
          paymentId: paymentReceipts.paymentId,
          receiptUrl: paymentReceipts.receiptUrl,
          transactionDate: paymentReceipts.transactionDate,
          adminNotes: paymentReceipts.adminNotes,
        })
        .from(paymentReceipts)
        .where(inArray(paymentReceipts.paymentId, paymentIds))
        .orderBy(desc(paymentReceipts.createdAt))
    : [];

  const latestReceiptByPayment = new Map<string, (typeof receipts)[number]>();
  for (const receipt of receipts) {
    if (!latestReceiptByPayment.has(receipt.paymentId)) {
      latestReceiptByPayment.set(receipt.paymentId, receipt);
    }
  }

  const pending = rows.filter((row) => row.status === "PENDING_CONFIRMATION");
  const others = rows.filter((row) => row.status !== "PENDING_CONFIRMATION");

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 py-3">
      <Link
        href={`/${tenantSlug}/groups/${groupSlug}/dues`}
        className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        Back to group dues
      </Link>

      <div>
        <h1 className="text-lg font-semibold text-neutral-900">{due.title}</h1>
        <p className="text-sm text-neutral-500">
          {formatNaira(Number(due.amount))} · Due {new Date(due.dueDate).toLocaleDateString("en-NG")}
        </p>
      </div>

      <div className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-neutral-900">Pending Review ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No receipts awaiting review.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-4 divide-y divide-neutral-100">
            {pending.map((row) => {
              const receipt = latestReceiptByPayment.get(row.paymentId);
              return (
                <li key={row.paymentId} className="flex flex-col gap-2 pt-4 first:pt-0 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-3">
                    {receipt && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={receipt.receiptUrl}
                        alt="Payment receipt"
                        className="h-20 w-20 rounded-md border border-neutral-100 object-cover"
                      />
                    )}
                    <div>
                      <p className="text-sm font-medium text-neutral-900">
                        {row.firstName} {row.lastName}
                      </p>
                      {receipt && (
                        <p className="text-xs text-neutral-500">
                          Transferred {new Date(receipt.transactionDate).toLocaleDateString("en-NG")}
                        </p>
                      )}
                      {receipt?.adminNotes && (
                        <p className="text-xs text-neutral-500">{receipt.adminNotes}</p>
                      )}
                    </div>
                  </div>
                  <VerifyPayment tenantSlug={tenantSlug} paymentId={row.paymentId} />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-neutral-900">All Members</h2>
        <ul className="mt-2 flex flex-col divide-y divide-neutral-100">
          {others.map((row) => (
            <li key={row.paymentId} className="flex items-center justify-between py-2">
              <p className="text-sm text-neutral-900">
                {row.firstName} {row.lastName}
              </p>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[row.status]}`}>
                {row.status.replace("_", " ")}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
