import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { getActiveInviteByToken } from "@/lib/invites";

/** Public lookup — only reveals the school name when the invite token is valid. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const result = await getActiveInviteByToken(token);

    if (!result) {
      return NextResponse.json({ error: "This invite link is invalid or has been revoked" }, { status: 404 });
    }

    return NextResponse.json({
      token: result.invite.token,
      tenantName: result.tenant.name,
      tenantSlug: result.tenant.slug,
      logoUrl: result.tenant.logoUrl,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
