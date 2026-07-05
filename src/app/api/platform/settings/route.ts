import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { platformSettings, auditLogs } from "@/db/schema";
import { getPlatformAdminUser } from "@/lib/platform-access";
import { getPlatformSettings } from "@/lib/platform-settings";
import { handleApiError } from "@/lib/api-error";

const updateSettingsSchema = z.object({
  trialDays: z.number().int().positive().max(365),
  gracePeriodDays: z.number().int().nonnegative().max(90),
});

/** Platform admin edits the platform-wide trial length and billing grace period. */
export async function PATCH(req: NextRequest) {
  try {
    const admin = await getPlatformAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    const body = updateSettingsSchema.parse(await req.json());

    const before = await getPlatformSettings();
    const existing = await db.query.platformSettings.findFirst();

    const [updated] = existing
      ? await db
          .update(platformSettings)
          .set({
            trialDays: body.trialDays,
            gracePeriodDays: body.gracePeriodDays,
            updatedAt: new Date(),
          })
          .where(eq(platformSettings.id, existing.id))
          .returning()
      : await db
          .insert(platformSettings)
          .values({ trialDays: body.trialDays, gracePeriodDays: body.gracePeriodDays })
          .returning();

    await db.insert(auditLogs).values({
      actorId: admin.id,
      action: "SETTINGS_UPDATE",
      entityType: "platform_settings",
      entityId: updated.id,
      payload: {
        platformAdminEmail: admin.email,
        before,
        after: { trialDays: updated.trialDays, gracePeriodDays: updated.gracePeriodDays },
      },
    });

    return NextResponse.json({ trialDays: updated.trialDays, gracePeriodDays: updated.gracePeriodDays });
  } catch (error) {
    return handleApiError(error);
  }
}
