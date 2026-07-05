import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { supportTickets } from "@/db/schema";
import { getPlatformAdminUser } from "@/lib/platform-access";
import { handleApiError } from "@/lib/api-error";

const updateTicketSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
});

/** Platform admin updates a support ticket's status or priority. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const admin = await getPlatformAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    const { ticketId } = await params;
    const body = updateTicketSchema.parse(await req.json());

    const [updated] = await db
      .update(supportTickets)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(supportTickets.id, ticketId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    return NextResponse.json({ id: updated.id, status: updated.status, priority: updated.priority });
  } catch (error) {
    return handleApiError(error);
  }
}
