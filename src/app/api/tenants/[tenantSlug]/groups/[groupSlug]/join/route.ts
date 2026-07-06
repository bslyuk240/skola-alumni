import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { tenantMemberships, groupMemberships } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getTenantGroup } from "@/lib/group-access";
import { handleApiError } from "@/lib/api-error";

const joinSchema = z.object({
  securityAnswer: z.string().trim().min(1).max(500).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string; groupSlug: string }> }
) {
  try {
    const { tenantSlug, groupSlug } = await params;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Access Denied" }, { status: 401 });
    }

    const resolved = await getTenantGroup(tenantSlug, groupSlug);
    if (!resolved) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Must be an approved member of the parent tenant before joining any of its groups.
    const tenantMembership = await db.query.tenantMemberships.findFirst({
      where: and(
        eq(tenantMemberships.tenantId, resolved.tenant.id),
        eq(tenantMemberships.userId, user.id)
      ),
    });
    if (!tenantMembership || tenantMembership.status !== "APPROVED") {
      return NextResponse.json({ error: "Resource Not Found" }, { status: 404 });
    }

    const existingMembership = await db.query.groupMemberships.findFirst({
      where: and(eq(groupMemberships.groupId, resolved.group.id), eq(groupMemberships.userId, user.id)),
    });
    if (existingMembership) {
      return NextResponse.json({ id: existingMembership.id, status: existingMembership.status });
    }

    const body = joinSchema.parse(await req.json().catch(() => ({})));

    if (resolved.group.securityQuestion && !body.securityAnswer) {
      return NextResponse.json({ error: "Please answer the security question to request to join" }, { status: 400 });
    }

    const autoApprove = !resolved.group.requireJoinApproval;

    const [membership] = await db
      .insert(groupMemberships)
      .values({
        groupId: resolved.group.id,
        userId: user.id,
        status: autoApprove ? "APPROVED" : "PENDING",
        groupRole: "MEMBER",
        approvedBy: autoApprove ? user.id : undefined,
        securityAnswer: body.securityAnswer,
      })
      .returning();

    return NextResponse.json(
      { id: membership.id, status: membership.status },
      { status: autoApprove ? 200 : 202 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
