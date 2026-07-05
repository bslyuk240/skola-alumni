import Link from "next/link";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { tenants, tenantMemberships, profiles, users } from "@/db/schema";
import { DirectorySearch } from "./_components/directory-search";

interface PrivacySettings {
  show_phone: boolean;
  show_email: boolean;
  show_whatsapp: boolean;
  show_city: boolean;
  show_business: boolean;
  show_groups: boolean;
  allow_messages: boolean;
}

export interface DirectoryCard {
  userId: string;
  fullName: string;
  graduationYear: number | null;
  avatarUrl: string | null;
  city: string | null;
  country: string | null;
  industry: string | null;
  occupation: string | null;
  businessName: string | null;
  email: string | null;
  whatsappPhone: string | null;
}

async function getDirectoryEntries(tenantId: string, query: string): Promise<DirectoryCard[]> {
  const rows = await db
    .select({
      userId: tenantMemberships.userId,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      graduationYear: profiles.graduationYear,
      avatarUrl: profiles.avatarUrl,
      locationCity: profiles.locationCity,
      locationCountry: profiles.locationCountry,
      industry: profiles.industry,
      occupation: profiles.occupation,
      businessName: profiles.businessName,
      email: users.email,
      phoneNumber: profiles.phoneNumber,
      privacySettings: profiles.privacySettings,
    })
    .from(tenantMemberships)
    .innerJoin(profiles, eq(profiles.userId, tenantMemberships.userId))
    .innerJoin(users, eq(users.id, tenantMemberships.userId))
    .where(and(eq(tenantMemberships.tenantId, tenantId), eq(tenantMemberships.status, "APPROVED")));

  const normalizedQuery = query.trim().toLowerCase();

  const cards: DirectoryCard[] = rows.map((row) => {
    const privacy = row.privacySettings as PrivacySettings;
    return {
      userId: row.userId,
      fullName: `${row.firstName} ${row.lastName}`,
      graduationYear: row.graduationYear,
      avatarUrl: row.avatarUrl,
      city: privacy.show_city ? row.locationCity : null,
      country: privacy.show_city ? row.locationCountry : null,
      industry: privacy.show_business ? row.industry : null,
      occupation: privacy.show_business ? row.occupation : null,
      businessName: privacy.show_business ? row.businessName : null,
      email: privacy.show_email ? row.email : null,
      whatsappPhone: privacy.show_whatsapp ? row.phoneNumber : null,
    };
  });

  if (!normalizedQuery) return cards;

  return cards.filter((card) => {
    const searchableFields = [
      card.fullName,
      card.city,
      card.country,
      card.industry,
      card.occupation,
      card.businessName,
    ];
    return searchableFields.some((field) => field?.toLowerCase().includes(normalizedQuery));
  });
}

export default async function DirectoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { tenantSlug } = await params;
  const { q } = await searchParams;

  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, tenantSlug) });
  if (!tenant) {
    return null;
  }

  const entries = await getDirectoryEntries(tenant.id, q ?? "");

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 py-3">
      <h1 className="text-lg font-semibold text-neutral-900">Member Directory</h1>
      <DirectorySearch initialQuery={q ?? ""} />

      {entries.length === 0 ? (
        <div className="rounded-lg border border-neutral-100 bg-white p-6 text-center shadow-sm">
          <h2 className="text-base font-semibold text-neutral-900">No Matches Found</h2>
          <p className="mt-1 text-sm text-neutral-700">
            No members match your current search details. Verify your spelling or search terms.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li
              key={entry.userId}
              className="flex items-center gap-3 rounded-lg border border-neutral-100 bg-white p-4 shadow-sm"
            >
              <Link
                href={`/${tenantSlug}/profile/${entry.userId}`}
                className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-100 text-sm font-semibold text-primary-700"
              >
                {entry.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={entry.avatarUrl} alt={entry.fullName} className="h-full w-full object-cover" />
                ) : (
                  entry.fullName
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900">
                  <Link href={`/${tenantSlug}/profile/${entry.userId}`} className="hover:underline">
                    {entry.fullName}
                  </Link>
                  {entry.graduationYear && (
                    <span className="ml-2 text-xs font-medium text-neutral-500">
                      Class of {entry.graduationYear}
                    </span>
                  )}
                </p>
                {(entry.occupation || entry.businessName) && (
                  <p className="truncate text-xs text-neutral-700">
                    {[entry.occupation, entry.businessName].filter(Boolean).join(" · ")}
                  </p>
                )}
                {entry.city && (
                  <p className="truncate text-xs text-neutral-500">
                    {[entry.city, entry.country].filter(Boolean).join(", ")}
                  </p>
                )}
                {entry.email && (
                  <a href={`mailto:${entry.email}`} className="truncate text-xs text-primary-600 hover:underline">
                    {entry.email}
                  </a>
                )}
              </div>
              {entry.whatsappPhone && (
                <a
                  href={`https://wa.me/${entry.whatsappPhone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Message on WhatsApp"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-100 text-success-700 hover:bg-success-100/70"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4.5 w-4.5">
                    <path d="M12.04 2c-5.52 0-10 4.48-10 10 0 1.77.46 3.45 1.27 4.9L2 22l5.25-1.38a9.96 9.96 0 0 0 4.79 1.22h.01c5.52 0 10-4.48 10-10s-4.48-10-10-10Zm0 18.15h-.01a8.2 8.2 0 0 1-4.17-1.14l-.3-.18-3.12.82.83-3.04-.2-.31a8.17 8.17 0 0 1-1.25-4.35c0-4.52 3.68-8.2 8.21-8.2 2.19 0 4.25.85 5.8 2.4a8.15 8.15 0 0 1 2.4 5.8c0 4.52-3.68 8.2-8.19 8.2Zm4.5-6.15c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.53.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.15.16-.25.24-.42.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.39 1.01 2.56.12.17 1.75 2.67 4.25 3.74.59.26 1.06.41 1.42.52.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.23-.16-.48-.28Z" />
                  </svg>
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
