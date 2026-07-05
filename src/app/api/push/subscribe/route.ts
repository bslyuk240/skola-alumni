import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";

const subscribeSchema = z.object({ fcmToken: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Access Denied" }, { status: 401 });
    }

    const body = subscribeSchema.parse(await req.json());

    await db
      .insert(pushSubscriptions)
      .values({ userId: user.id, fcmToken: body.fcmToken })
      .onConflictDoNothing({ target: pushSubscriptions.fcmToken });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
