import Link from "next/link";

// Placeholder inbox — swap for a real support address before launch.
export const SUPPORT_EMAIL = "support@skolaalumni.app";

export function LegalDocument({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <Link href="/" className="text-xs font-medium text-neutral-500 hover:text-neutral-700">
          ← Skola Alumni
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-neutral-900">{title}</h1>
        <p className="mt-1 text-xs text-neutral-500">Last updated {lastUpdated}</p>
      </div>

      <div className="flex flex-col gap-5">{children}</div>
    </main>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold text-neutral-900">{heading}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-neutral-700">{children}</div>
    </section>
  );
}
