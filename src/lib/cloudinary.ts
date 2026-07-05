import { v2 as cloudinary } from "cloudinary";
import { getCloudinaryEnv } from "@/config/env";

export const MAX_RECEIPT_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB, per blueprint constraint
export const MAX_AVATAR_UPLOAD_BYTES = 2 * 1024 * 1024; // 2MB, per blueprint constraint
export const ALLOWED_UPLOAD_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"];

interface SignedUploadParams {
  folder: string;
  publicIdPrefix?: string;
}

/** Returns signed params a client can use to upload directly to Cloudinary, bypassing server compute. */
export function createSignedUploadParams({ folder, publicIdPrefix }: SignedUploadParams) {
  const cloudinaryEnv = getCloudinaryEnv();
  cloudinary.config({
    cloud_name: cloudinaryEnv.CLOUDINARY_CLOUD_NAME,
    api_key: cloudinaryEnv.CLOUDINARY_API_KEY,
    api_secret: cloudinaryEnv.CLOUDINARY_SECRET,
    secure: true,
  });

  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign: Record<string, string | number> = {
    timestamp,
    folder,
    ...(publicIdPrefix ? { public_id: `${publicIdPrefix}-${timestamp}` } : {}),
  };

  const signature = cloudinary.utils.api_sign_request(paramsToSign, cloudinaryEnv.CLOUDINARY_SECRET);

  return {
    ...paramsToSign,
    signature,
    apiKey: cloudinaryEnv.CLOUDINARY_API_KEY,
    cloudName: cloudinaryEnv.CLOUDINARY_CLOUD_NAME,
  };
}

export { cloudinary };
