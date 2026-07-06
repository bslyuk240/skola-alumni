"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";
import { OnboardingShell } from "./onboarding-shell";

interface Step1FormProps {
  tenantSlug: string;
  currentLogoUrl: string | null;
}

interface CloudinarySignedParams {
  timestamp: number;
  folder: string;
  public_id?: string;
  allowed_formats?: string;
  signature: string;
  apiKey: string;
  cloudName: string;
}

export function Step1Form({ tenantSlug, currentLogoUrl }: Step1FormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogoUrl);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleFileChange(file: File | undefined) {
    if (!file) return;

    setUploading(true);
    setErrorMessage(null);

    try {
      const signed = await fetchJson<CloudinarySignedParams>("/api/cloudinary/sign", {
        method: "POST",
        body: { folder: "tenant-logos" },
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

      if (!uploadResponse.ok) {
        throw new Error("Upload to Cloudinary failed");
      }

      const uploaded = await uploadResponse.json();
      setPreviewUrl(uploaded.secure_url);

      await fetchJson(`/api/tenants/${tenantSlug}`, {
        method: "PATCH",
        body: { logoUrl: uploaded.secure_url },
      });
    } catch {
      setErrorMessage("Couldn't upload your logo right now. You can add one later from Settings.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <OnboardingShell
      step={1}
      eyebrow="Workspace Setup"
      title="Add your association's identity"
      subtitle="Upload your school or association logo — you can always change this later."
    >
      {errorMessage && (
        <div className="mb-4 rounded-md border-l-4 border-error-600 bg-error-100 px-4 py-3 text-sm text-error-700">
          {errorMessage}
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-neutral-300 bg-neutral-50 transition-colors hover:border-primary-500 disabled:cursor-not-allowed"
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Association logo" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-8 w-8 text-neutral-500" strokeWidth={1.5} />
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(e) => handleFileChange(e.target.files?.[0])}
        />
        <p className="text-xs text-neutral-500">{uploading ? "Uploading..." : "Tap to upload a logo"}</p>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => router.push(`/onboarding/step-2?tenant=${tenantSlug}`)}
          disabled={uploading}
          className="rounded-md bg-primary-600 px-4 py-3.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
        >
          Continue
        </button>
        <button
          type="button"
          onClick={() => router.push(`/onboarding/step-2?tenant=${tenantSlug}`)}
          className="text-center text-xs font-medium text-neutral-500 hover:text-neutral-700"
        >
          Skip for now
        </button>
      </div>
    </OnboardingShell>
  );
}
