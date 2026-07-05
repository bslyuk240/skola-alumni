"use client";

import { useState, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, X } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";

interface CloudinarySignedParams {
  timestamp: number;
  folder: string;
  public_id?: string;
  signature: string;
  apiKey: string;
  cloudName: string;
}

export function PostComposer({ tenantSlug }: { tenantSlug: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleFileSelect(file: File | undefined) {
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      let mediaUrl: string | undefined;

      if (imageFile) {
        const signed = await fetchJson<CloudinarySignedParams>("/api/cloudinary/sign", {
          method: "POST",
          body: { folder: "post-media" },
        });

        const formData = new FormData();
        formData.append("file", imageFile);
        formData.append("timestamp", String(signed.timestamp));
        formData.append("signature", signed.signature);
        formData.append("api_key", signed.apiKey);
        formData.append("folder", signed.folder);
        if (signed.public_id) formData.append("public_id", signed.public_id);

        const uploadResponse = await fetch(
          `https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`,
          { method: "POST", body: formData }
        );
        if (!uploadResponse.ok) throw new Error("Image upload failed");
        const uploaded = await uploadResponse.json();
        mediaUrl = uploaded.secure_url;
      }

      await fetchJson(`/api/tenants/${tenantSlug}/posts`, {
        method: "POST",
        body: { content, mediaUrl },
      });

      setContent("");
      setImageFile(null);
      setImagePreview(null);
      router.refresh();
    } catch {
      setErrorMessage("Couldn't publish your post. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-neutral-100 bg-white p-4 shadow-sm"
    >
      {errorMessage && (
        <div className="rounded-md border-l-4 border-error-600 bg-error-100 px-3 py-2 text-xs text-error-700">
          {errorMessage}
        </div>
      )}

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Share an update with your alumni community..."
        rows={3}
        className="input resize-none"
      />

      {imagePreview && (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagePreview} alt="Attachment preview" className="max-h-48 rounded-md object-cover" />
          <button
            type="button"
            onClick={() => {
              setImageFile(null);
              setImagePreview(null);
            }}
            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900/70 text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-700"
        >
          <ImagePlus className="h-4 w-4" strokeWidth={1.75} />
          Photo
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files?.[0])}
        />

        <button
          type="submit"
          disabled={submitting || !content.trim()}
          className="rounded-md bg-primary-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
        >
          {submitting ? "Publishing..." : "Publish Post"}
        </button>
      </div>
    </form>
  );
}
