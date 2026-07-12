"use client";

import { useState } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";

export function InviteLinkCard({
  initialUrl,
  tenantSlug,
  compact = false,
}: {
  initialUrl: string;
  tenantSlug: string;
  compact?: boolean;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErrorMessage("Couldn't copy. Select the link and copy manually.");
    }
  }

  async function handleWhatsApp() {
    const message = encodeURIComponent(
      `Join our alumni association on Skola Alumni:\n${url}`
    );
    window.open(`https://wa.me/?text=${message}`, "_blank", "noopener,noreferrer");
  }

  async function handleRegenerate() {
    if (
      !window.confirm(
        "Generate a new invite link? The old link will stop working for anyone who hasn't joined yet."
      )
    ) {
      return;
    }

    setRegenerating(true);
    setErrorMessage(null);
    try {
      const result = await fetchJson<{ url: string }>(`/api/tenants/${tenantSlug}/invite`, {
        method: "POST",
      });
      setUrl(result.url);
    } catch {
      setErrorMessage("Couldn't regenerate the link. Try again.");
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-neutral-100 bg-white p-4 shadow-sm"
          : "rounded-lg border border-primary-100 bg-primary-50 p-5"
      }
    >
      <h2 className="text-sm font-semibold text-neutral-900">Invite members</h2>
      <p className="mt-1 text-xs text-neutral-600">
        Share this private link in your WhatsApp group. Schools are not listed publicly — only people
        with the link can join.
      </p>

      {errorMessage && (
        <p className="mt-3 text-xs text-error-700">{errorMessage}</p>
      )}

      <div className="mt-3 flex items-stretch gap-2">
        <input
          readOnly
          value={url}
          className="input min-w-0 flex-1 truncate text-xs"
          onFocus={(e) => e.target.select()}
        />
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-700"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleWhatsApp}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Share on WhatsApp
        </button>
        <button
          type="button"
          disabled={regenerating}
          onClick={handleRegenerate}
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
          {regenerating ? "Regenerating..." : "Regenerate link"}
        </button>
      </div>
    </div>
  );
}
