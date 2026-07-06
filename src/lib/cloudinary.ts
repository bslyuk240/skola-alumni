import { v2 as cloudinary } from "cloudinary";
import { getCloudinaryEnv } from "@/config/env";
import { MAX_POST_IMAGE_BYTES, MAX_POST_VIDEO_BYTES } from "@/lib/media-limits";

export const MAX_RECEIPT_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB, per blueprint constraint
export const MAX_AVATAR_UPLOAD_BYTES = 2 * 1024 * 1024; // 2MB, per blueprint constraint
export const ALLOWED_UPLOAD_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"];

function configureCloudinary() {
  const cloudinaryEnv = getCloudinaryEnv();
  cloudinary.config({
    cloud_name: cloudinaryEnv.CLOUDINARY_CLOUD_NAME,
    api_key: cloudinaryEnv.CLOUDINARY_API_KEY,
    api_secret: cloudinaryEnv.CLOUDINARY_SECRET,
    secure: true,
  });
  return cloudinaryEnv;
}

interface SignedUploadParams {
  folder: string;
  publicIdPrefix?: string;
  /** Restricts which file extensions Cloudinary will accept for this upload — enforced by
   * Cloudinary itself, not just a client-side hint, since it's part of the signed request. */
  allowedFormats?: string[];
}

/** Returns signed params a client can use to upload directly to Cloudinary, bypassing server compute. */
export function createSignedUploadParams({ folder, publicIdPrefix, allowedFormats }: SignedUploadParams) {
  const cloudinaryEnv = configureCloudinary();

  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign: Record<string, string | number> = {
    timestamp,
    folder,
    ...(publicIdPrefix ? { public_id: `${publicIdPrefix}-${timestamp}` } : {}),
    ...(allowedFormats ? { allowed_formats: allowedFormats.join(",") } : {}),
  };

  const signature = cloudinary.utils.api_sign_request(paramsToSign, cloudinaryEnv.CLOUDINARY_SECRET);

  return {
    ...paramsToSign,
    signature,
    apiKey: cloudinaryEnv.CLOUDINARY_API_KEY,
    cloudName: cloudinaryEnv.CLOUDINARY_CLOUD_NAME,
  };
}

/**
 * Authoritative, server-side check that a post's media is genuinely ours and within size limits.
 * Client-reported file size can't be trusted (the upload itself bypasses our server entirely), so
 * this re-fetches the resource's real size from Cloudinary's own records and deletes it if it's
 * over the cap — closing the gap where someone could bypass the browser's size check.
 */
export async function verifyPostMedia(
  mediaUrl: string,
  publicId: string,
  resourceType: "image" | "video"
): Promise<void> {
  const cloudinaryEnv = configureCloudinary();

  const expectedPrefix = `https://res.cloudinary.com/${cloudinaryEnv.CLOUDINARY_CLOUD_NAME}/`;
  if (!mediaUrl.startsWith(expectedPrefix)) {
    throw new Error("Media must be uploaded through this app's own Cloudinary account.");
  }

  const resource = await cloudinary.api.resource(publicId, { resource_type: resourceType });
  const maxBytes = resourceType === "video" ? MAX_POST_VIDEO_BYTES : MAX_POST_IMAGE_BYTES;

  if (resource.bytes > maxBytes) {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    throw new Error(resourceType === "video" ? "Video must be under 50MB." : "Image must be under 10MB.");
  }
}

export { cloudinary };
