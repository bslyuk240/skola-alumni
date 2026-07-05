import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSignedUploadParams } from "@/lib/cloudinary";

const ALLOWED_FOLDERS = ["receipts", "avatars", "tenant-logos", "post-media"] as const;
type AllowedFolder = (typeof ALLOWED_FOLDERS)[number];

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Access Denied" }, { status: 401 });
  }

  const body = await req.json();
  const folder = body.folder as string | undefined;

  if (!folder || !ALLOWED_FOLDERS.includes(folder as AllowedFolder)) {
    return NextResponse.json({ error: "Invalid upload target" }, { status: 400 });
  }

  const signedParams = createSignedUploadParams({ folder: `skola-alumni/${folder}`, publicIdPrefix: userId });

  return NextResponse.json(signedParams);
}
