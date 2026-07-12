import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedGroupMembership, getTenantGroup } from "@/lib/group-access";
import {
  GROUP_LIVE_HOST_ROLES,
  getActiveLiveSession,
  getLivePlanGate,
  publicLiveSessionPayload,
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
          Someone is already live. Open Live controls to end it if you have permission.
        </div>
        <Link
          href={`/${tenantSlug}/groups/${groupSlug}/live`}
          className="rounded-md bg-primary-600 px-4 py-2.5 text-center text-sm font-medium text-white"
        >
          Open Live controls
        </Link>
      </main>
    );
  }

  if (existing && existing.groupId && existing.groupId !== resolved.group.id) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 py-4">
        <div className="rounded-lg border border-neutral-100 bg-white p-6 text-sm text-neutral-700 shadow-sm">
          Another live is active in this association. End it before starting a new one.
        </div>
        <Link
          href={`/${tenantSlug}/live`}
          className="rounded-md bg-primary-600 px-4 py-2.5 text-center text-sm font-medium text-white"
        >
          Open Live
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 py-4">
      <Link href={`/${tenantSlug}/groups/${groupSlug}/live`} className="text-sm text-primary-600">
        ← Back
      </Link>
      <h1 className="text-lg font-semibold text-neutral-900">
        {existing ? "Broadcast desk" : `Go live — ${resolved.group.name}`}
      </h1>
      <LiveHostPanel
        tenantSlug={tenantSlug}
        groupSlug={groupSlug}
        scopeLabel={resolved.group.name}
        existingSession={
          existing && existing.groupId === resolved.group.id
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
