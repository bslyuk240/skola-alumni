import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedGroupMembership, getTenantGroup } from "@/lib/group-access";
import {
  GROUP_LIVE_HOST_ROLES,
  getActiveLiveSession,
  getLivePlanGate,
} from "@/lib/live-access";
import { LiveHostPanel } from "../../../../live/_components/live-panels";

export default async function GroupLiveHostPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; groupSlug: string }>;
}) {
  const { tenantSlug, groupSlug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const resolved = await getTenantGroup(tenantSlug, groupSlug);
  if (!resolved) notFound();

  const host = await getAuthorizedGroupMembership(user.id, resolved.group.id, GROUP_LIVE_HOST_ROLES);
  if (!host) redirect(`/${tenantSlug}/groups/${groupSlug}/live`);

  const planGate = await getLivePlanGate(resolved.tenant.id);
  if (!planGate.ok) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 py-4">
        <Link
          href={`/${tenantSlug}/groups/${groupSlug}/live`}
          className="text-sm text-primary-600"
        >
          ← Back
        </Link>
        <div className="rounded-lg border border-warning-100 bg-warning-100 px-4 py-3 text-sm text-warning-700">
          {planGate.error}
        </div>
      </main>
    );
  }

  const existing = await getActiveLiveSession(resolved.tenant.id);
  if (existing && existing.hostUserId !== user.id) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 py-4">
        <div className="rounded-lg border border-neutral-100 bg-white p-6 text-sm text-neutral-700 shadow-sm">
          Someone is already live in this association. Only one live is allowed at a time.
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 py-4">
      <Link href={`/${tenantSlug}/groups/${groupSlug}/live`} className="text-sm text-primary-600">
        ← Back
      </Link>
      <h1 className="text-lg font-semibold text-neutral-900">Go live — {resolved.group.name}</h1>
      <LiveHostPanel
        tenantSlug={tenantSlug}
        groupSlug={groupSlug}
        scopeLabel={resolved.group.name}
      />
    </main>
  );
}
