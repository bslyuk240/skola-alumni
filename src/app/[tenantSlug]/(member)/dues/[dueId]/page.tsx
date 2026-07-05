import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { tenants, dues, payments, paymentReceipts } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { ReceiptUploadForm } from "./_components/receipt-upload-form";

interface BankDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

export default async function MemberDueDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; dueId: string }>;
}) {
  const { tenantSlug, dueId } = await params;

  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, tenantSlug) });
  if (!tenant) notFound();

  const user = await getCurrentUser();
  if (!user) notFound();

  const due = await db.query.dues.findFirst({
    where: and(eq(dues.id, dueId), eq(dues.tenantId, tenant.id)),
  });
  if (!due) notFound();

  const payment = await db.query.payments.findFirst({
    where: and(eq(payments.dueId, due.id), eq(payments.userId, user.id)),
  });
  if (!payment) notFound();

  const latestReceipt = payment
    ? await db.query.paymentReceipts.findFirst({
        where: eq(paymentReceipts.paymentId, payment.id),
        orderBy: (table, { desc }) => desc(table.createdAt),
      })
    : null;

  const bankDetails = tenant.bankDetails as BankDetails | null;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-6">
      <div className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
        <h1 className="text-lg font-semibold text-neutral-900">{due.title}</h1>
        <p className="mt-1 text-2xl font-bold text-primary-700">{formatNaira(Number(due.amount))}</p>
        <p className="text-xs text-neutral-500">
          Due {new Date(due.dueDate).toLocaleDateString("en-NG")}
        </p>
      </div>

      {payment.status === "PAID" && (
        <div className="rounded-lg border border-success-100 bg-success-100 p-4 text-center">
          <p className="text-sm font-semibold text-success-700">Payment Confirmed</p>
          <p className="mt-1 text-xs text-success-700">Thank you — your treasurer has verified this payment.</p>
        </div>
      )}

      {payment.status === "PENDING_CONFIRMATION" && (
        <div className="rounded-lg border border-warning-100 bg-warning-100 p-4 text-center">
          <p className="text-sm font-semibold text-warning-700">Awaiting Confirmation</p>
          <p className="mt-1 text-xs text-warning-700">
            Your receipt is being reviewed by the association treasurer.
          </p>
        </div>
      )}

      {(payment.status === "UNPAID" || payment.status === "REJECTED") && (
        <>
          {payment.status === "REJECTED" && latestReceipt?.adminNotes && (
            <div className="rounded-lg border border-error-100 bg-error-100 p-4">
              <p className="text-sm font-semibold text-error-700">Receipt Declined</p>
              <p className="mt-1 text-xs text-error-700">{latestReceipt.adminNotes}</p>
            </div>
          )}

          {bankDetails && (
            <div className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-neutral-900">Bank Transfer Details</h2>
              <dl className="mt-2 flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-neutral-500">Bank Name</dt>
                  <dd className="font-medium text-neutral-900">{bankDetails.bankName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-neutral-500">Account Number</dt>
                  <dd className="font-medium text-neutral-900">{bankDetails.accountNumber}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-neutral-500">Account Name</dt>
                  <dd className="font-medium text-neutral-900">{bankDetails.accountName}</dd>
                </div>
              </dl>
            </div>
          )}

          <div className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-neutral-900">Upload Payment Receipt</h2>
            <ReceiptUploadForm tenantSlug={tenantSlug} dueId={dueId} />
          </div>
        </>
      )}
    </main>
  );
}
