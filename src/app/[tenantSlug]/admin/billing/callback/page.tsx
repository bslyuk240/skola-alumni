import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { verifyPaystackTransaction } from "@/lib/paystack";
import { applySubscriptionPayment } from "@/lib/apply-subscription-payment";

export default async function BillingCallbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ reference?: string }>;
}) {
  const { tenantSlug } = await params;
  const { reference } = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const authorized = await getAuthorizedTenantMembership(user.id, tenantSlug, [
    "President/School Owner",
  ]);
  if (!authorized) redirect(`/${tenantSlug}/admin`);

  if (!reference) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-lg border border-error-100 bg-error-100 p-6 text-center">
          <h1 className="text-base font-semibold text-error-700">Missing payment reference</h1>
          <p className="mt-2 text-sm text-error-700">
            We couldn&rsquo;t find a transaction reference in the return URL.
          </p>
        </div>
      </main>
    );
  }

  let succeeded = false;
  let errorMessage: string | null = null;

  try {
    const transaction = await verifyPaystackTransaction(reference);

    if (transaction.status === "success") {
      const metadata = transaction.metadata;
      await applySubscriptionPayment({
        tenantId: metadata.tenantId as string,
        planName: metadata.planName as string,
        billingCycle: metadata.billingCycle as "MONTHLY" | "YEARLY",
        paystackReference: transaction.reference,
      });
      succeeded = true;
    } else {
      errorMessage = "Payment was not completed. Please try again.";
    }
  } catch {
    errorMessage = "Couldn't verify your payment with Paystack. Please try again or contact support.";
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div
        className={`w-full max-w-md rounded-lg border p-6 text-center ${
          succeeded ? "border-success-100 bg-success-100" : "border-error-100 bg-error-100"
        }`}
      >
        <h1 className={`text-base font-semibold ${succeeded ? "text-success-700" : "text-error-700"}`}>
          {succeeded ? "Subscription Activated" : "Payment Not Completed"}
        </h1>
        <p className={`mt-2 text-sm ${succeeded ? "text-success-700" : "text-error-700"}`}>
          {succeeded
            ? "Thank you. Your school association space is successfully activated."
            : errorMessage}
        </p>
        <Link
          href={succeeded ? `/${tenantSlug}/admin` : `/${tenantSlug}/admin/billing`}
          className="mt-4 inline-block rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          {succeeded ? "Go to Dashboard" : "Try Again"}
        </Link>
      </div>
    </main>
  );
}
