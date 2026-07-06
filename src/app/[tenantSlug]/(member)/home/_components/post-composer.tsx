"use client";

import { useState, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, X } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";
import { MAX_POST_IMAGE_BYTES, MAX_POST_VIDEO_BYTES } from "@/lib/media-limits";

interface CloudinarySignedParams {
  timestamp: number;
  folder: string;
  public_id?: string;
  signature: string;
  apiKey: string;
  cloudName: string;
}

export function PostComposer({
  tenantSlug,
  groupSlug,
}: {
  tenantSlug: string;
  groupSlug?: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState("");
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleFileSelect(file: File | undefined) {
    if (!file) return;
    setErrorMessage(null);

    const video = file.type.startsWith("video/");
    const maxBytes = video ? MAX_POST_VIDEO_BYTES : MAX_POST_IMAGE_BYTES;

    if (file.size > maxBytes) {
      setErrorMessage(
        video ? "Video must be under 50MB." : "Image must be under 10MB."
      );
      return;
    }

    setIsVideo(video);
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      let mediaUrl: string | undefined;
      let mediaPublicId: string | undefined;
      let mediaResourceType: string | undefined;

      if (mediaFile) {
        const signed = await fetchJson<CloudinarySignedParams>("/api/cloudinary/sign", {
          method: "POST",
          body: { folder: "post-media" },
        });

        const formData = new FormData();
        formData.append("file", mediaFile);
        formData.append("timestamp", String(signed.timestamp));
        formData.append("signature", signed.signature);
        formData.append("api_key", signed.apiKey);
        formData.append("folder", signed.folder);
        if (signed.public_id) formData.append("public_id", signed.public_id);

        // "auto" lets Cloudinary detect image vs video from the file itself — no signing
        // changes needed since resource_type isn't part of the signed parameters.
        const uploadResponse = await fetch(
          `https://api.cloudinary.com/v1_1/${signed.cloudName}/auto/upload`,
          { method: "POST", body: formData }
        );
        if (!uploadResponse.ok) throw new Error("Media upload failed");
        const uploaded = await uploadResponse.json();
        mediaUrl = uploaded.secure_url;
        mediaPublicId = uploaded.public_id;
        mediaResourceType = uploaded.resource_type;
      }

      const endpoint = groupSlug
        ? `/api/tenants/${tenantSlug}/groups/${groupSlug}/posts`
        : `/api/tenants/${tenantSlug}/posts`;

      await fetchJson(endpoint, {
        method: "POST",
        body: { content, mediaUrl, mediaPublicId, mediaResourceType },
      });

      setContent("");
      setMediaFile(null);
      setMediaPreview(null);
      setIsVideo(false);
      if (textareaRef.current) textareaRef.current.style.height = "auto";
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
        ref={textareaRef}
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
        }}
        placeholder={groupSlug ? "Share an update with this group..." : "Share an update with your alumni community..."}
        rows={1}
        className="input resize-none overflow-y-auto"
      />

      {mediaPreview && (
        <div className="relative w-fit">
          {isVideo ? (
            <video src={mediaPreview} className="max-h-48 rounded-md" controls />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaPreview} alt="Attachment preview" className="max-h-48 rounded-md object-cover" />
          )}
          <button
            type="button"
            onClick={() => {
              setMediaFile(null);
              setMediaPreview(null);
              setIsVideo(false);
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
          Photo/Video
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
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
