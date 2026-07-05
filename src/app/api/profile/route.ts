import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";

const privacySettingsSchema = z.object({
  show_phone: z.boolean(),
  show_email: z.boolean(),
  show_whatsapp: z.boolean(),
  show_city: z.boolean(),
  show_business: z.boolean(),
  show_groups: z.boolean(),
  allow_messages: z.boolean(),
});

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  avatarUrl: z.string().url().optional().or(z.literal("")),
  graduationYear: z.number().int().min(1900).max(2100).optional(),
  bio: z.string().max(2000).optional().or(z.literal("")),
  locationCity: z.string().max(100).optional().or(z.literal("")),
  locationCountry: z.string().max(100).optional().or(z.literal("")),
  industry: z.string().max(120).optional().or(z.literal("")),
  occupation: z.string().max(150).optional().or(z.literal("")),
  businessName: z.string().max(200).optional().or(z.literal("")),
  businessDesc: z.string().max(2000).optional().or(z.literal("")),
  phoneNumber: z.string().max(30).optional().or(z.literal("")),
  socialLinks: z.record(z.string(), z.string()).optional(),
  privacySettings: privacySettingsSchema,
});

/** Single global profile per user (schema: one profile, many tenant/group memberships). */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Access Denied" }, { status: 401 });
    }

    const body = updateProfileSchema.parse(await req.json());

    const existing = await db.query.profiles.findFirst({ where: eq(profiles.userId, user.id) });

    const values = {
      firstName: body.firstName,
      lastName: body.lastName,
      avatarUrl: body.avatarUrl || null,
      graduationYear: body.graduationYear,
      bio: body.bio || null,
      locationCity: body.locationCity || null,
      locationCountry: body.locationCountry || null,
      industry: body.industry || null,
      occupation: body.occupation || null,
      businessName: body.businessName || null,
      businessDesc: body.businessDesc || null,
      phoneNumber: body.phoneNumber || null,
      socialLinks: body.socialLinks ?? {},
      privacySettings: body.privacySettings,
    };

    if (existing) {
      await db
        .update(profiles)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(profiles.userId, user.id));
    } else {
      await db.insert(profiles).values({ userId: user.id, ...values });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
