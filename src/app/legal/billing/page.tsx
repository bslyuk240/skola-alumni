import Link from "next/link";
import { LegalDocument, LegalSection, SUPPORT_EMAIL } from "../_components/legal-document";

export default function BillingPolicyPage() {
  return (
    <LegalDocument title="Billing & Refund Policy" lastUpdated="July 6, 2026">
      <LegalSection heading="1. Two Kinds of Payments">
        <p>Skola Alumni involves two separate flows of money, and it&apos;s important to know which is which:</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <strong>Association subscriptions</strong> — the fee your association pays Skola Alumni
            to use the platform. This is processed by us, as described below.
          </li>
          <li>
            <strong>Member dues</strong> — money members pay to their own association (e.g. annual
            dues). This happens off-platform (typically bank transfer); we only help your
            association track and verify it. See Section 5.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="2. Association Subscriptions">
        <p>
          Associations on a paid plan are billed on a recurring cycle through our payment
          processor. Your plan determines things like member limits and available features.
          Pricing is shown before you subscribe or upgrade.
        </p>
      </LegalSection>

      <LegalSection heading="3. Failed Payments &amp; Grace Periods">
        <p>
          If a subscription renewal fails or lapses, we provide a short grace period before
          restricting access to paid features, so your association has time to update payment
          details. Exceeding your plan&apos;s member limit may also restrict some actions until you
          upgrade.
        </p>
      </LegalSection>

      <LegalSection heading="4. Refunds for Subscriptions">
        <p>
          Subscription fees are generally non-refundable once a billing period has started, except
          where required by law or at our discretion for billing errors. Contact us if you believe
          you were charged incorrectly.
        </p>
      </LegalSection>

      <LegalSection heading="5. Member Dues Are Not Processed By Skola Alumni">
        <p>
          When a member pays dues to their association, that payment happens directly between the
          member and the association (e.g. a bank transfer) — Skola Alumni is not a party to that
          transaction, does not hold the funds, and cannot issue refunds for it. Members upload a
          receipt as proof of payment, and the association&apos;s treasurer/admin reviews and verifies
          it within the app. Any dispute about a dues payment should be raised directly with your
          association&apos;s administrators.
        </p>
      </LegalSection>

      <LegalSection heading="6. Changes to Pricing">
        <p>
          We&apos;ll give advance notice before changing subscription pricing or plan limits for
          existing associations.
        </p>
      </LegalSection>

      <LegalSection heading="7. Contact">
        <p>
          Billing questions? Reach us at{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary-600 hover:underline">
            {SUPPORT_EMAIL}
          </a>
          . See also our{" "}
          <Link href="/legal/terms" className="text-primary-600 hover:underline">
            Terms of Service
          </Link>
          .
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
