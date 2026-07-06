"use client";

import { useState, useRef, type FormEvent } from "react";
import { useClerk } from "@clerk/nextjs";
import { ImagePlus, LogOut } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";
import { Toggle } from "@/components/ui/toggle";
import { ThemeToggle } from "@/components/theme-toggle";

interface PrivacySettings {
  show_phone: boolean;
  show_email: boolean;
  show_whatsapp: boolean;
  show_city: boolean;
  show_business: boolean;
  show_groups: boolean;
  allow_messages: boolean;
}

interface ProfileData {
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  graduationYear: number | null;
  bio: string;
  locationCity: string;
  locationCountry: string;
  industry: string;
  occupation: string;
  businessName: string;
  businessDesc: string;
  phoneNumber: string;
  privacySettings: PrivacySettings;
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

const PRIVACY_TOGGLES: { key: keyof PrivacySettings; label: string; helper: string }[] = [
  { key: "show_email", label: "Show email address", helper: "Visible on your directory card" },
  { key: "show_phone", label: "Show phone number", helper: "Displays your raw number publicly" },
  { key: "show_whatsapp", label: "Show WhatsApp button", helper: "Lets members message you without revealing the number" },
  { key: "show_city", label: "Show city & country", helper: "" },
  { key: "show_business", label: "Show business & industry", helper: "" },
  { key: "allow_messages", label: "Allow direct messages", helper: "" },
];

export function ProfileForm({ initial }: { initial: ProfileData }) {
  const { signOut } = useClerk();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function update<K extends keyof ProfileData>(key: K, value: ProfileData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updatePrivacy(key: keyof PrivacySettings, value: boolean) {
    setForm((prev) => ({ ...prev, privacySettings: { ...prev.privacySettings, [key]: value } }));
  }

  async function handleAvatarChange(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setErrorMessage(null);

    try {
      const signed = await fetchJson<CloudinarySignedParams>("/api/cloudinary/sign", {
        method: "POST",
        body: { folder: "avatars" },
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
      update("avatarUrl", uploaded.secure_url);
    } catch {
      setErrorMessage("Couldn't upload your photo right now. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    setSavedAt(null);

    try {
      await fetchJson("/api/profile", {
        method: "PATCH",
        body: {
          firstName: form.firstName,
          lastName: form.lastName,
          avatarUrl: form.avatarUrl || undefined,
          graduationYear: form.graduationYear ?? undefined,
          bio: form.bio,
          locationCity: form.locationCity,
          locationCountry: form.locationCountry,
          industry: form.industry,
          occupation: form.occupation,
          businessName: form.businessName,
          businessDesc: form.businessDesc,
          phoneNumber: form.phoneNumber,
          privacySettings: form.privacySettings,
        },
      });
      setSavedAt(Date.now());
    } catch {
      setErrorMessage("Couldn't save your profile. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-6">
      <h1 className="text-lg font-semibold text-neutral-900">My Profile</h1>

      {errorMessage && (
        <div className="rounded-md border-l-4 border-error-600 bg-error-100 px-4 py-3 text-sm text-error-700">
          {errorMessage}
        </div>
      )}
      {savedAt && (
        <div className="rounded-md border-l-4 border-success-600 bg-success-100 px-4 py-3 text-sm text-success-700">
          Profile updated successfully.
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-neutral-300 bg-white transition-colors hover:border-primary-500 disabled:cursor-not-allowed"
          >
            {form.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.avatarUrl} alt="Profile photo" className="h-full w-full object-cover" />
            ) : (
              <ImagePlus className="h-7 w-7 text-neutral-500" strokeWidth={1.5} />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => handleAvatarChange(e.target.files?.[0])}
          />
          <p className="text-xs text-neutral-500">{uploading ? "Uploading..." : "Tap to change photo"}</p>
        </div>

        <section className="flex flex-col gap-3 rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">Basic Identity</h2>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-700">Email</span>
            <input value={form.email} disabled className="input cursor-not-allowed opacity-70" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="First Name" value={form.firstName} onChange={(v) => update("firstName", v)} />
            <TextField label="Last Name" value={form.lastName} onChange={(v) => update("lastName", v)} />
          </div>
          <TextField
            label="Graduation Class Year"
            type="number"
            value={form.graduationYear?.toString() ?? ""}
            onChange={(v) => update("graduationYear", v ? Number(v) : null)}
          />
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">Professional Info</h2>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Industry" value={form.industry} onChange={(v) => update("industry", v)} />
            <TextField label="Occupation" value={form.occupation} onChange={(v) => update("occupation", v)} />
          </div>
          <TextField label="Business Name" value={form.businessName} onChange={(v) => update("businessName", v)} />
          <TextAreaField
            label="Business Description"
            value={form.businessDesc}
            onChange={(v) => update("businessDesc", v)}
          />
          <TextAreaField label="Bio" value={form.bio} onChange={(v) => update("bio", v)} />
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">Contact & Location</h2>
          <TextField label="Phone Number" value={form.phoneNumber} onChange={(v) => update("phoneNumber", v)} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="City" value={form.locationCity} onChange={(v) => update("locationCity", v)} />
            <TextField label="Country" value={form.locationCountry} onChange={(v) => update("locationCountry", v)} />
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">Appearance</h2>
          <ThemeToggle />
        </section>

        <section className="flex flex-col gap-1 rounded-lg border border-neutral-100 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-neutral-900">Privacy</h2>
          {PRIVACY_TOGGLES.map(({ key, label, helper }) => (
            <div key={key} className="flex items-center justify-between gap-4 py-2.5">
              <div>
                <p className="text-sm text-neutral-900">{label}</p>
                {helper && <p className="text-xs text-neutral-500">{helper}</p>}
              </div>
              <Toggle
                checked={form.privacySettings[key]}
                onChange={(next) => updatePrivacy(key, next)}
                label={label}
              />
            </div>
          ))}
        </section>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-primary-600 px-4 py-3.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
        >
          {submitting ? "Saving..." : "Save Profile Changes"}
        </button>

        <button
          type="button"
          onClick={() => signOut({ redirectUrl: "/" })}
          className="flex items-center justify-center gap-2 rounded-md border border-neutral-300 px-4 py-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.75} />
          Log Out
        </button>
      </form>
    </main>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-neutral-700">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="input" />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-neutral-700">{label}</span>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input resize-none"
      />
    </label>
  );
}
