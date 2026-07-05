import { notFound, redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { tenants, tenantMemberships, profiles, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

interface PrivacySettings {
  show_phone: boolean;
  show_email: boolean;
  show_whatsapp: boolean;
  show_city: boolean;
  show_business: boolean;
  show_groups: boolean;
  allow_messages: boolean;
}

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ tenantSlug: string; userId: string }>;
}) {
  const { tenantSlug, userId } = await params;

  const currentUser = await getCurrentUser();
  if (currentUser?.id === userId) redirect(`/${tenantSlug}/profile/me`);

  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, tenantSlug) });
  if (!tenant) notFound();

  const row = await db
    .select({
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      avatarUrl: profiles.avatarUrl,
      graduationYear: profiles.graduationYear,
      bio: profiles.bio,
      locationCity: profiles.locationCity,
      locationCountry: profiles.locationCountry,
      industry: profiles.industry,
      occupation: profiles.occupation,
      businessName: profiles.businessName,
      businessDesc: profiles.businessDesc,
      phoneNumber: profiles.phoneNumber,
      privacySettings: profiles.privacySettings,
      email: users.email,
    })
    .from(tenantMemberships)
    .innerJoin(profiles, eq(profiles.userId, tenantMemberships.userId))
    .innerJoin(users, eq(users.id, tenantMemberships.userId))
    .where(
      and(
        eq(tenantMemberships.tenantId, tenant.id),
        eq(tenantMemberships.userId, userId),
        eq(tenantMemberships.status, "APPROVED")
      )
    )
    .then((rows) => rows[0]);

  if (!row) notFound();

  const privacy = row.privacySettings as PrivacySettings;
  const fullName = `${row.firstName} ${row.lastName}`;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-6">
      <div className="flex flex-col items-center gap-3 rounded-lg border border-neutral-100 bg-white p-6 text-center shadow-sm">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-primary-100 text-lg font-semibold text-primary-700">
          {row.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.avatarUrl} alt={fullName} className="h-full w-full object-cover" />
          ) : (
            fullName
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
          )}
        </div>
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">{fullName}</h1>
          {row.graduationYear && <p className="text-sm text-neutral-500">Class of {row.graduationYear}</p>}
        </div>
        {row.bio && <p className="text-sm text-neutral-700">{row.bio}</p>}
      </div>

      {privacy.show_business && (row.industry || row.occupation || row.businessName) && (
        <section className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">Professional</h2>
          {(row.occupation || row.industry) && (
            <p className="mt-1 text-sm text-neutral-700">
              {[row.occupation, row.industry].filter(Boolean).join(" · ")}
            </p>
          )}
          {row.businessName && (
            <p className="mt-2 text-sm font-medium text-neutral-900">{row.businessName}</p>
          )}
          {row.businessDesc && <p className="mt-1 text-xs text-neutral-500">{row.businessDesc}</p>}
        </section>
      )}

      {(privacy.show_city || privacy.show_email || (privacy.show_whatsapp && row.phoneNumber)) && (
        <section className="rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">Contact</h2>
          {privacy.show_city && row.locationCity && (
            <p className="mt-1 text-sm text-neutral-700">
              {[row.locationCity, row.locationCountry].filter(Boolean).join(", ")}
            </p>
          )}
          {privacy.show_email && (
            <a href={`mailto:${row.email}`} className="mt-1 block text-sm text-primary-600 hover:underline">
              {row.email}
            </a>
          )}
          {privacy.show_whatsapp && row.phoneNumber && (
            <a
              href={`https://wa.me/${row.phoneNumber.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block rounded-md bg-success-100 px-3 py-1.5 text-xs font-medium text-success-700 hover:bg-success-100/70"
            >
              Message on WhatsApp
            </a>
          )}
        </section>
      )}
    </main>
  );
}
