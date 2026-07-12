import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";

/**
 * Open self-join is disabled. Members must redeem a private invite link instead
 * (`POST /api/invites/[token]/redeem`) so registered schools stay undiscoverable.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  try {
    await params;
    return NextResponse.json(
      {
        error:
          "Joining requires a private invite link. Ask your association admin to share the invite from their dashboard.",
      },
      { status: 403 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
