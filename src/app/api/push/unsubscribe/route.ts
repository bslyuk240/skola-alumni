import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { removePushSubscription } from "@/lib/firebase-admin";
import { handleApiError } from "@/lib/api-error";

const unsubscribeSchema = z.object({ fcmToken: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Access Denied" }, { status: 401 });
    }

    const body = unsubscribeSchema.parse(await req.json());
    await removePushSubscription(user.id, body.fcmToken);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
