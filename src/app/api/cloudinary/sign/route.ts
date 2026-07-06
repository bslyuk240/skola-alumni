import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSignedUploadParams } from "@/lib/cloudinary";
import { ALLOWED_POST_MEDIA_FORMATS } from "@/lib/media-limits";

const ALLOWED_FOLDERS = ["receipts", "avatars", "tenant-logos", "group-avatars", "post-media"] as const;
type AllowedFolder = (typeof ALLOWED_FOLDERS)[number];

// Restricts which file extensions Cloudinary will accept per upload target — enforced by
// Cloudinary itself (part of the signed request), not just the browser's file picker hint.
const ALLOWED_FORMATS_BY_FOLDER: Partial<Record<AllowedFolder, string[]>> = {
  "post-media": ALLOWED_POST_MEDIA_FORMATS,
  avatars: ["jpg", "jpeg", "png", "webp"],
  "tenant-logos": ["jpg", "jpeg", "png", "webp"],
  "group-avatars": ["jpg", "jpeg", "png", "webp"],
  receipts: ["jpg", "jpeg", "png", "pdf"],
};

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

  const signedParams = createSignedUploadParams({
    folder: `skola-alumni/${folder}`,
    publicIdPrefix: userId,
    allowedFormats: ALLOWED_FORMATS_BY_FOLDER[folder as AllowedFolder],
  });

  return NextResponse.json(signedParams);
}
