import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenants, subscriptions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { getBillingLockStatus } from "@/lib/billing-status";
import { AdminSidebar } from "./_components/admin-sidebar";

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default async function TenantAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const authorized = await getAuthorizedTenantMembership(user.id, tenantSlug, [
    "President/School Owner",
    "Finance Admin",
    "Secretary",
    "Announcement Manager",
  ]);
  if (!authorized) redirect(`/${tenantSlug}/home`);

  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, tenantSlug) });
  if (!tenant) redirect(`/${tenantSlug}/home`);

  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.tenantId, tenant.id),
  });

  const lockStatus = await getBillingLockStatus(tenant.id);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <AdminSidebar
        tenantSlug={tenantSlug}
        tenantName={tenant.name}
        logoUrl={tenant.logoUrl}
        planLabel={subscription ? formatStatus(subscription.status) : "No Plan"}
      />
      <div className="flex flex-1 flex-col bg-neutral-50">
        {lockStatus.message && (
          <div
            className={`flex flex-col items-start gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:px-6 ${
              lockStatus.locked ? "bg-error-600 text-white" : "bg-warning-100 text-warning-700"
            }`}
          >
            <span>{lockStatus.message}</span>
            <Link
              href={`/${tenantSlug}/admin/billing`}
              className={`font-medium underline ${lockStatus.locked ? "text-white" : "text-warning-700"}`}
            >
              {lockStatus.locked ? "Upgrade Now" : "Renew Now"}
            </Link>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
