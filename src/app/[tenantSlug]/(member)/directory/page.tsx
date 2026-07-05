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
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-6">
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
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
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
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900">
                  {entry.fullName}
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
                  className="shrink-0 rounded-md bg-success-100 px-3 py-1.5 text-xs font-medium text-success-700 hover:bg-success-100/70"
                >
                  WhatsApp
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
