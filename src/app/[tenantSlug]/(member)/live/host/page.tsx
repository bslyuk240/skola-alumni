import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import {
  SCHOOL_LIVE_HOST_ROLES,
  getActiveLiveSession,
  getGroupSlugForSession,
  getLivePlanGate,
  publicLiveSessionPayload,
} from "@/lib/live-access";
import { LiveHostPanel } from "../_components/live-panels";

export default async function TenantLiveHostPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const authorized = await getAuthorizedTenantMembership(user.id, tenantSlug, SCHOOL_LIVE_HOST_ROLES);
  if (!authorized) redirect(`/${tenantSlug}/live`);

  const planGate = await getLivePlanGate(authorized.tenant.id);
  if (!planGate.ok) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 py-4">
        <Link href={`/${tenantSlug}/live`} className="text-sm text-primary-600">
          ← Back to Live
        </Link>
        <div className="rounded-lg border border-warning-100 bg-warning-100 px-4 py-3 text-sm text-warning-700">
          {planGate.error}
        </div>
        <Link
          href={`/${tenantSlug}/admin/billing`}
          className="rounded-md bg-primary-600 px-4 py-2.5 text-center text-sm font-medium text-white"
        >
          Upgrade plan
        </Link>
      </main>
    );
  }

  const existing = await getActiveLiveSession(authorized.tenant.id);

  if (existing && existing.hostUserId !== user.id) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 py-4">
        <Link href={`/${tenantSlug}/live`} className="text-sm text-primary-600">
          ← Back to Live
        </Link>
        <div className="rounded-lg border border-neutral-100 bg-white p-6 text-sm text-neutral-700 shadow-sm">
          Someone is already live. Open Live controls to end it if you have permission.
        </div>
        <Link
          href={`/${tenantSlug}/live`}
          className="rounded-md bg-primary-600 px-4 py-2.5 text-center text-sm font-medium text-white"
        >
          Open Live controls
        </Link>
      </main>
    );
  }

  const groupSlug = existing ? await getGroupSlugForSession(existing.groupId) : null;
  if (existing?.groupId && groupSlug) {
    redirect(`/${tenantSlug}/groups/${groupSlug}/live/host`);
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 py-4">
      <Link href={`/${tenantSlug}/live`} className="text-sm text-primary-600">
        ← Back to Live
      </Link>
      <h1 className="text-lg font-semibold text-neutral-900">
        {existing ? "Broadcast desk" : "Go live"}
      </h1>
      <LiveHostPanel
        tenantSlug={tenantSlug}
        scopeLabel={authorized.tenant.name}
        existingSession={
          existing
            ? {
                ...publicLiveSessionPayload(existing, { groupSlug }),
                startedAt: existing.startedAt.toISOString(),
                whipPublishUrl: existing.whipPublishUrl,
              }
            : null
        }
      />
    </main>
  );
}
