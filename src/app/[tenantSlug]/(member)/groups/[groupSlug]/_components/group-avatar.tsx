"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";

interface CloudinarySignedParams {
  timestamp: number;
  folder: string;
  public_id?: string;
  allowed_formats?: string;
  signature: string;
  apiKey: string;
  cloudName: string;
}

export function GroupAvatar({
  tenantSlug,
  groupSlug,
  groupName,
  avatarUrl,
  editable,
}: {
  tenantSlug: string;
  groupSlug: string;
  groupName: string;
  avatarUrl: string | null;
  editable: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleFileChange(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setErrorMessage(null);

    try {
      const signed = await fetchJson<CloudinarySignedParams>("/api/cloudinary/sign", {
        method: "POST",
        body: { folder: "group-avatars" },
      });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("timestamp", String(signed.timestamp));
      formData.append("signature", signed.signature);
      formData.append("api_key", signed.apiKey);
      formData.append("folder", signed.folder);
      if (signed.public_id) formData.append("public_id", signed.public_id);
      if (signed.allowed_formats) formData.append("allowed_formats", signed.allowed_formats);

      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`,
        { method: "POST", body: formData }
      );
      if (!uploadResponse.ok) throw new Error("Upload failed");
      const uploaded = await uploadResponse.json();

      await fetchJson(`/api/tenants/${tenantSlug}/groups/${groupSlug}`, {
        method: "PATCH",
        body: { avatarUrl: uploaded.secure_url },
      });

      setPreview(uploaded.secure_url);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Couldn't upload the group photo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary-100 text-lg font-semibold text-primary-700">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={groupName} className="h-full w-full object-cover" />
          ) : (
            groupName.slice(0, 2).toUpperCase()
          )}
        </div>

        {editable && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label="Change group photo"
            className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Camera className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}

        {editable && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => handleFileChange(e.target.files?.[0])}
          />
        )}
      </div>

      {uploading && <p className="text-xs text-neutral-500">Uploading...</p>}
      {errorMessage && <p className="text-xs text-error-700">{errorMessage}</p>}
    </div>
  );
}
