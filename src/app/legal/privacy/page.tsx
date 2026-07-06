import Link from "next/link";
import { LegalDocument, LegalSection, SUPPORT_EMAIL } from "../_components/legal-document";

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument title="Privacy Policy" lastUpdated="July 6, 2026">
      <LegalSection heading="1. Information We Collect">
        <p>We collect information you provide directly, including:</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>Account details: name, email address, password (managed by our authentication provider)</li>
          <li>
            Profile information: photo, bio, graduation year, location, occupation, business
            details, phone number — most of which you control the visibility of
          </li>
          <li>Dues records: receipts you upload as proof of payment to your association</li>
          <li>Content you post: text, photos, and videos shared in feeds and groups</li>
        </ul>
        <p>We also collect some information automatically, like basic usage and device data needed to run the app and push notifications.</p>
      </LegalSection>

      <LegalSection heading="2. How We Use Your Information">
        <ul className="ml-4 list-disc space-y-1">
          <li>To operate your association&apos;s workspace — directory, dues tracking, groups, feeds</li>
          <li>To send notifications you&apos;ve opted into (e.g. push notifications for group activity)</li>
          <li>To verify dues payments your association&apos;s treasurer reviews</li>
          <li>To keep the Service secure and prevent abuse</li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. Who Can See Your Information">
        <p>
          Your profile is visible to approved members of your association, subject to the privacy
          toggles in your Profile settings (you control whether your email, phone number, city, and
          business details are shown). Tenant and group admins can see membership and dues status
          within their own association — they cannot see other associations&apos; data.
        </p>
      </LegalSection>

      <LegalSection heading="4. Third-Party Services We Use">
        <p>We rely on the following providers to run the Service. Each only receives the data needed to perform its function:</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>Authentication and account security</li>
          <li>Database hosting for your association&apos;s data</li>
          <li>Media hosting for photos and videos you upload</li>
          <li>Payment processing for association subscription billing</li>
          <li>Email and push notification delivery</li>
        </ul>
        <p>We do not sell your personal information to third parties.</p>
      </LegalSection>

      <LegalSection heading="5. Your Privacy Controls">
        <p>
          From your Profile page you can control whether your email, phone number, WhatsApp
          button, city/country, and business details are visible to other members, and whether
          members can message you directly.
        </p>
      </LegalSection>

      <LegalSection heading="6. Data Retention">
        <p>
          We retain your data for as long as your account or your association&apos;s workspace is
          active. If you or your association wants data deleted, contact us using the details
          below.
        </p>
      </LegalSection>

      <LegalSection heading="7. Data Security">
        <p>
          We use industry-standard measures to protect your data, including encrypted connections
          and access controls scoped per association. No system is perfectly secure, so we can&apos;t
          guarantee absolute security.
        </p>
      </LegalSection>

      <LegalSection heading="8. Children&apos;s Privacy">
        <p>The Service is intended for alumni of legal age and is not directed at children under 13.</p>
      </LegalSection>

      <LegalSection heading="9. Changes to This Policy">
        <p>We may update this policy from time to time. We&apos;ll update the date at the top when we do.</p>
      </LegalSection>

      <LegalSection heading="10. Contact">
        <p>
          Questions about your data? Reach us at{" "}
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
