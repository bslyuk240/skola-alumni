import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { getClerkWebhookEnv } from "@/config/env";
import { db } from "@/db";
import { users } from "@/db/schema";

interface ClerkUserCreatedEvent {
  type: string;
  data: {
    id: string;
    email_addresses: { id: string; email_address: string }[];
    primary_email_address_id: string;
  };
}

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const headers = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };

  const webhook = new Webhook(getClerkWebhookEnv().CLERK_WEBHOOK_SECRET);

  let event: ClerkUserCreatedEvent;
  try {
    event = webhook.verify(payload, headers) as ClerkUserCreatedEvent;
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  if (event.type === "user.created") {
    const primaryEmail = event.data.email_addresses.find(
      (address) => address.id === event.data.primary_email_address_id
    )?.email_address;

    if (primaryEmail) {
      await db
        .insert(users)
        .values({ clerkId: event.data.id, email: primaryEmail })
        .onConflictDoNothing({ target: users.clerkId });
    }
  }

  return NextResponse.json({ received: true });
}
