import Link from "next/link";
import { getActiveInviteByToken } from "@/lib/invites";
import { InviteActions } from "./_components/invite-actions";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getActiveInviteByToken(token);

  if (!result) {
    return (
      <main className="flex min-h-dvh flex-1 flex-col bg-primary-900">
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col">
          <div className="flex flex-col gap-2 px-6 pb-8 pt-10 text-white">
            <span className="text-xs font-semibold uppercase tracking-widest text-white/50">
              Skola Alumni
            </span>
            <h1 className="text-2xl font-bold leading-tight">Invite not found</h1>
            <p className="text-sm text-white/70">
              This link is invalid or was revoked. Ask your association admin for a new invite.
            </p>
          </div>
          <div className="flex flex-1 flex-col rounded-t-[28px] bg-white px-6 pb-10 pt-8 shadow-lg">
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-3.5 text-sm font-medium text-white hover:bg-primary-700"
            >
              Go to sign in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const { tenant } = result;

  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-primary-900">
      <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col">
        <div className="flex flex-col gap-2 px-6 pb-8 pt-10 text-white">
          <span className="text-xs font-semibold uppercase tracking-widest text-white/50">
            You&rsquo;re invited
          </span>
          <h1 className="text-2xl font-bold leading-tight">{tenant.name}</h1>
          <p className="text-sm text-white/70">
            Create your login credentials to join this alumni space. Next time, sign in normally and
            you&rsquo;ll land here.
          </p>
        </div>

        <div className="flex flex-1 flex-col rounded-t-[28px] bg-white px-6 pb-10 pt-8 shadow-lg">
          {tenant.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logoUrl}
              alt={tenant.name}
              className="mb-6 h-16 w-16 rounded-full object-cover"
            />
          )}
          <InviteActions token={token} tenantName={tenant.name} tenantSlug={tenant.slug} />
        </div>
      </div>
    </main>
  );
}
