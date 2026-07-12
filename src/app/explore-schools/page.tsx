import Link from "next/link";

/** Public school directory removed — joining is invite-link only. */
export default function ExploreSchoolsPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-6 py-12">
      <h1 className="text-lg font-semibold text-neutral-900">Joining is by invite only</h1>
      <p className="text-sm text-neutral-700">
        Alumni associations are private on Skola Alumni. Ask your association admin for the invite
        link they shared (usually in WhatsApp), then open it to create your account and join.
      </p>
      <div className="flex flex-col gap-2">
        <Link
          href="/sign-in"
          className="rounded-md bg-primary-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-primary-700"
        >
          Sign in
        </Link>
        <Link
          href="/sign-up?type=tenant"
          className="rounded-md border border-neutral-300 px-4 py-2.5 text-center text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Register a new alumni association
        </Link>
      </div>
    </main>
  );
}
