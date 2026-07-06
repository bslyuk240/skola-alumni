import Link from "next/link";
import { LegalDocument, LegalSection, SUPPORT_EMAIL } from "../_components/legal-document";

export default function TermsOfServicePage() {
  return (
    <LegalDocument title="Terms of Service" lastUpdated="July 6, 2026">
      <LegalSection heading="1. Acceptance of Terms">
        <p>
          By creating an account or using Skola Alumni (&ldquo;the Service&rdquo;), you agree to these Terms of
          Service. If you&apos;re registering an alumni association or school as a tenant, you&apos;re also
          agreeing on behalf of that organization.
        </p>
      </LegalSection>

      <LegalSection heading="2. What Skola Alumni Is">
        <p>
          Skola Alumni is a multi-tenant platform that lets alumni associations run a private
          member directory, dues tracking, groups, and announcements for their community. Each
          association (&ldquo;tenant&rdquo;) operates in its own isolated workspace.
        </p>
      </LegalSection>

      <LegalSection heading="3. Accounts &amp; Eligibility">
        <p>
          You must provide accurate information when creating an account. You&apos;re responsible for
          activity that happens under your account and for keeping your login credentials secure.
        </p>
      </LegalSection>

      <LegalSection heading="4. Associations, Membership &amp; Roles">
        <p>
          Joining a tenant requires approval from that association&apos;s administrators. Once
          approved, an admin may assign you roles (e.g. executive positions) that grant additional
          permissions within that tenant. Admins are responsible for who they approve and what
          access they grant within their own association.
        </p>
      </LegalSection>

      <LegalSection heading="5. Groups &amp; Community Content">
        <p>
          Class sets, chapters, and committees are member-created groups within a tenant. Group
          creators and the admins they promote are responsible for moderating their own groups.
          Some groups require answering a security question to join — this is a manual review aid
          for the group&apos;s admins, not a guarantee of identity.
        </p>
      </LegalSection>

      <LegalSection heading="6. Acceptable Use">
        <p>You agree not to use the Service to:</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>Impersonate another person or misrepresent your affiliation with an association</li>
          <li>Upload content that is illegal, harassing, or infringes someone else&apos;s rights</li>
          <li>Attempt to access another tenant&apos;s data without authorization</li>
          <li>Interfere with or disrupt the Service&apos;s normal operation</li>
        </ul>
        <p>Posts and media can be reported and removed by group or tenant admins.</p>
      </LegalSection>

      <LegalSection heading="7. Dues Collected By Your Association">
        <p>
          Some associations track member dues in the Service. Dues payments themselves happen
          outside the platform (e.g. bank transfer); members upload a receipt, and the association&apos;s
          treasurer verifies it. Skola Alumni does not process or hold these funds — see our{" "}
          <Link href="/legal/billing" className="text-primary-600 hover:underline">
            Billing &amp; Refund Policy
          </Link>{" "}
          for details.
        </p>
      </LegalSection>

      <LegalSection heading="8. Subscriptions &amp; Billing">
        <p>
          Associations may subscribe to a paid plan for additional capacity or features. Billing
          terms are covered in our{" "}
          <Link href="/legal/billing" className="text-primary-600 hover:underline">
            Billing &amp; Refund Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection heading="9. Termination">
        <p>
          You may stop using the Service at any time. We may suspend or terminate accounts or
          tenants that violate these terms, or that we reasonably believe pose a risk to other
          users or the Service.
        </p>
      </LegalSection>

      <LegalSection heading="10. Disclaimers &amp; Limitation of Liability">
        <p>
          The Service is provided &ldquo;as is&rdquo; without warranties of any kind. To the extent
          permitted by law, Skola Alumni is not liable for indirect, incidental, or consequential
          damages arising from your use of the Service, including disputes over dues collected
          off-platform by your association.
        </p>
      </LegalSection>

      <LegalSection heading="11. Changes to These Terms">
        <p>
          We may update these terms from time to time. Continued use of the Service after a change
          means you accept the updated terms.
        </p>
      </LegalSection>

      <LegalSection heading="12. Contact">
        <p>
          Questions about these terms? Reach us at{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary-600 hover:underline">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
