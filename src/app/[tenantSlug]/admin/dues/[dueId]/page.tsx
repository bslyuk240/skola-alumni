import { notFound, redirect } from "next/navigation";
import { eq, and, inArray, desc } from "drizzle-orm";
import { db } from "@/db";
import { dues, payments, profiles, paymentReceipts } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { VerifyPayment } from "./_components/verify-payment";

const FINANCE_ROLES = ["President/School Owner", "Finance Admin"];

const STATUS_STYLES: Record<string, string> = {
  PAID: "bg-success-100 text-success-700",
  PENDING_CONFIRMATION: "bg-warning-100 text-warning-700",
  REJECTED: "bg-error-100 text-error-700",
  UNPAID: "bg-neutral-100 text-neutral-700",
};

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

export default async function DueDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; dueId: string }>;
}) {
  const { tenantSlug, dueId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const authorized = await getAuthorizedTenantMembership(user.id, tenantSlug, FINANCE_ROLES);
  if (!authorized) redirect(`/${tenantSlug}/admin`);

  const due = await db.query.dues.findFirst({
    where: and(eq(dues.id, dueId), eq(dues.tenantId, authorized.tenant.id)),
  });
  if (!due) notFound();
  // Group-scoped dues are managed from the group's own page now, not the tenant admin section.
  if (due.groupId) redirect(`/${tenantSlug}/admin/dues`);

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
    <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6">
      <h1 className="text-xl font-semibold text-neutral-900">{due.title}</h1>
      <p className="text-sm text-neutral-500">
        {formatNaira(Number(due.amount))} · Due {new Date(due.dueDate).toLocaleDateString("en-NG")}
      </p>

      <div className="mt-4 rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
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

      <div className="mt-4 rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
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
