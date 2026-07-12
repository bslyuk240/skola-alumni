import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedTenantMembership } from "@/lib/tenant-access";
import { handleApiError } from "@/lib/api-error";
import { getOrCreateActiveInvite, inviteUrl, regenerateTenantInvite } from "@/lib/invites";

const INVITE_ADMIN_ROLES = ["President/School Owner", "Secretary"];

/** Returns the current invite link for the school (creates one if missing). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  try {
    const { tenantSlug } = await params;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Access Denied" }, { status: 401 });
    }

    const authorized = await getAuthorizedTenantMembership(user.id, tenantSlug, INVITE_ADMIN_ROLES);
    if (!authorized) {
      return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    const invite = await getOrCreateActiveInvite(authorized.tenant.id, user.id);

    return NextResponse.json({
      token: invite.token,
      url: inviteUrl(invite.token),
      createdAt: invite.createdAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Regenerates the invite link (revokes the previous one). */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  try {
    const { tenantSlug } = await params;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Access Denied" }, { status: 401 });
    }

    const authorized = await getAuthorizedTenantMembership(user.id, tenantSlug, INVITE_ADMIN_ROLES);
    if (!authorized) {
      return NextResponse.json({ error: "Access Denied" }, { status: 403 });
    }

    const invite = await regenerateTenantInvite(authorized.tenant.id, user.id);

    return NextResponse.json({
      token: invite.token,
      url: inviteUrl(invite.token),
      createdAt: invite.createdAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
