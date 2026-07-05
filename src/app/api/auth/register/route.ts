import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";

const registerProfileSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  graduationYear: z.number().int().min(1900).max(2100).optional(),
});

/** Creates (or updates) the profile row for the current Clerk session, right after sign-up OTP verification. */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Access Denied" }, { status: 401 });
    }

    const body = registerProfileSchema.parse(await req.json());

    const existing = await db.query.profiles.findFirst({ where: eq(profiles.userId, user.id) });

    if (existing) {
      await db
        .update(profiles)
        .set({
          firstName: body.firstName,
          lastName: body.lastName,
          graduationYear: body.graduationYear,
          updatedAt: new Date(),
        })
        .where(eq(profiles.userId, user.id));
    } else {
      await db.insert(profiles).values({
        userId: user.id,
        firstName: body.firstName,
        lastName: body.lastName,
        graduationYear: body.graduationYear,
      });
    }

    return NextResponse.json({ id: user.id }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
