"use client";

import { useState, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

interface CloudinarySignedParams {
  timestamp: number;
  folder: string;
  public_id?: string;
  allowed_formats?: string;
  signature: string;
  apiKey: string;
  cloudName: string;
}

export function ContributeForm({ tenantSlug, campaignId }: { tenantSlug: string; campaignId: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [transactionDate, setTransactionDate] = useState("");
  const [senderReference, setSenderReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function handleFileSelect(selected: File | undefined) {
    if (!selected) return;
    if (selected.size > MAX_RECEIPT_BYTES) {
      setErrorMessage("File too large — receipts must be under 5MB.");
      return;
    }
    setErrorMessage(null);
    setFile(selected);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setErrorMessage("Please attach a screenshot of your transfer confirmation.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const signed = await fetchJson<CloudinarySignedParams>("/api/cloudinary/sign", {
        method: "POST",
        body: { folder: "receipts" },
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

      await fetchJson(`/api/tenants/${tenantSlug}/donations/${campaignId}/contribute`, {
        method: "POST",
        body: {
          amount: Number(amount),
          receiptUrl: uploaded.secure_url,
          transactionDate: new Date(transactionDate).toISOString(),
          senderReference: senderReference || undefined,
        },
      });

      setSubmitted(true);
      router.refresh();
    } catch {
      setErrorMessage("Couldn't submit your contribution. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-lg border border-warning-100 bg-warning-100 p-4 text-center">
        <p className="text-sm font-semibold text-warning-700">Thank you!</p>
        <p className="mt-1 text-xs text-warning-700">Your contribution is awaiting confirmation.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {errorMessage && (
        <div className="rounded-md border-l-4 border-error-600 bg-error-100 px-3 py-2 text-xs text-error-700">
          {errorMessage}
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700">Amount (₦)</span>
        <input
          required
          type="number"
          min="1"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="input"
        />
      </label>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-center hover:border-primary-500"
      >
        <UploadCloud className="h-6 w-6 text-neutral-500" strokeWidth={1.5} />
        <span className="text-xs text-neutral-500">
          {file ? file.name : "Tap to upload a screenshot of your transfer (JPG, PNG, PDF, max 5MB)"}
        </span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,application/pdf"
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files?.[0])}
      />

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700">Transfer Date</span>
        <input
          required
          type="date"
          value={transactionDate}
          onChange={(e) => setTransactionDate(e.target.value)}
          className="input"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700">Sender Name / Reference</span>
        <input
          value={senderReference}
          onChange={(e) => setSenderReference(e.target.value)}
          placeholder="Optional"
          className="input"
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-primary-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
      >
        {submitting ? "Submitting..." : "Submit Contribution"}
      </button>
    </form>
  );
}
