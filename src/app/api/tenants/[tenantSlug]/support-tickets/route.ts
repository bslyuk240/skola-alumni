import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { supportTickets } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { handleApiError } from "@/lib/api-error";

const ADMIN_ROLES = ["President/School Owner", "Finance Admin", "Secretary", "Announcement Manager"];

const createTicketSchema = z.object({
  subject: z.string().min(1).max(255),
  message: z.string().min(1).max(5000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
});

/** Tenant admin files a support ticket to the Skola Alumni platform team. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  try {
    const { tenantSlug } = await params;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Access Denied" }, { status: 401 });
    }

    const authorized = await getAuthorizedTenantMembership(user.id, tenantSlug, ADMIN_ROLES);
    if (!authorized) {
      return NextResponse.json({ error: "Resource Not Found" }, { status: 404 });
    }

    const body = createTicketSchema.parse(await req.json());

    const [ticket] = await db
      .insert(supportTickets)
      .values({
        tenantId: authorized.tenant.id,
        createdByUserId: user.id,
        subject: body.subject,
        message: body.message,
        priority: body.priority,
      })
      .returning();

    return NextResponse.json({ id: ticket.id }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
