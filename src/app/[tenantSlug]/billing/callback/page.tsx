import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { verifyPaystackTransaction } from "@/lib/paystack";
import { parsePaystackMetadata } from "@/lib/paystack-metadata";
import { applySubscriptionPayment } from "@/lib/apply-subscription-payment";

const VALID_PLANS = new Set(["Starter", "Growth", "Association"]);

/**
 * Paystack return URL — kept OUTSIDE /admin so a failed admin-layout auth check can't
 * redirect to member home before the payment is applied.
 */
export default async function BillingCallbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}) {
  const { tenantSlug } = await params;
  const query = await searchParams;
  // Paystack may send `reference` or `trxref`
  const reference = query.reference ?? query.trxref;

  const user = await getCurrentUser();
  if (!user) {
    const returnPath = `/${tenantSlug}/billing/callback${reference ? `?reference=${encodeURIComponent(reference)}` : ""}`;
    redirect(`/sign-in?redirect_url=${encodeURIComponent(returnPath)}`);
  }

  const authorized = await getAuthorizedTenantMembership(user.id, tenantSlug, [
    "President/School Owner",
  ]);
  if (!authorized) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-lg border border-error-100 bg-error-100 p-6 text-center">
          <h1 className="text-base font-semibold text-error-700">Access needed</h1>
          <p className="mt-2 text-sm text-error-700">
            Only the association President can finalize billing. Sign in with that account, then reopen
            this link if you still have the payment reference.
          </p>
          <Link
            href={`/${tenantSlug}/home`}
            className="mt-4 inline-block rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Go to home
          </Link>
        </div>
      </main>
    );
  }

  if (!reference) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-lg border border-error-100 bg-error-100 p-6 text-center">
          <h1 className="text-base font-semibold text-error-700">Missing payment reference</h1>
          <p className="mt-2 text-sm text-error-700">
            We couldn&rsquo;t find a transaction reference in the return URL. Open Billing and try
            checkout again, or paste your Paystack reference on the billing page.
          </p>
          <Link
            href={`/${tenantSlug}/admin/billing`}
            className="mt-4 inline-block rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Go to billing
          </Link>
        </div>
      </main>
    );
  }

  let succeeded = false;
  let activatedPlan: string | null = null;
  let errorMessage: string | null = null;

  try {
    const transaction = await verifyPaystackTransaction(reference);

    if (transaction.status !== "success") {
      errorMessage = "Payment was not completed. Please try again.";
    } else {
      const metadata = parsePaystackMetadata(transaction.metadata);
      const planName = metadata.planName;
      const billingCycle = metadata.billingCycle;

      if (!planName || !VALID_PLANS.has(planName) || !billingCycle) {
        console.error("[billing/callback] Incomplete Paystack metadata", {
          reference,
          metadata: transaction.metadata,
          parsed: metadata,
        });
        throw new Error("Payment succeeded but plan details were missing from Paystack metadata.");
      }

      if (metadata.tenantId && metadata.tenantId !== authorized.tenant.id) {
        console.error("[billing/callback] Metadata tenant mismatch", {
          reference,
          metadataTenantId: metadata.tenantId,
          urlTenantId: authorized.tenant.id,
        });
        throw new Error("Payment tenant does not match this workspace.");
      }

      if (metadata.tenantSlug && metadata.tenantSlug !== tenantSlug) {
        throw new Error("Payment workspace slug does not match this workspace.");
      }

      await applySubscriptionPayment({
        tenantId: authorized.tenant.id,
        planName,
        billingCycle,
        paystackReference: transaction.reference,
      });

      succeeded = true;
      activatedPlan = planName;
    }
  } catch (error) {
    console.error("[billing/callback] Activation failed:", error);
    errorMessage =
      error instanceof Error
        ? error.message
        : "Couldn't verify your payment with Paystack. Please try again or contact support.";
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
            ? `Thank you. Your association is now on the ${activatedPlan} plan.`
            : errorMessage}
        </p>
        <Link
          href={`/${tenantSlug}/admin/billing`}
          className="mt-4 inline-block rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          {succeeded ? "View billing" : "Try Again"}
        </Link>
      </div>
    </main>
  );
}
