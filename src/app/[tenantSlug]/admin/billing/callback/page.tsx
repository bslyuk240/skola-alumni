import { redirect } from "next/navigation";

/** Legacy Paystack return path — forward to the non-admin callback so activation always runs. */
export default async function LegacyBillingCallbackRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}) {
  const { tenantSlug } = await params;
  const query = await searchParams;
  const reference = query.reference ?? query.trxref;
  const qs = reference ? `?reference=${encodeURIComponent(reference)}` : "";
  redirect(`/${tenantSlug}/billing/callback${qs}`);
}
