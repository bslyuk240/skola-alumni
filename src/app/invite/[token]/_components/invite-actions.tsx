"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { fetchJson } from "@/lib/fetch-json";

export function InviteActions({
  token,
  tenantName,
  tenantSlug,
}: {
  token: string;
  tenantName: string;
  tenantSlug: string;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleJoinAsSignedIn() {
    setJoining(true);
    setErrorMessage(null);
    try {
      await fetchJson(`/api/invites/${token}/redeem`, { method: "POST" });
      router.push(`/${tenantSlug}/home`);
    } catch {
      setErrorMessage("Couldn't join with this invite. Try again or ask for a new link.");
      setJoining(false);
    }
  }

  if (!isLoaded) {
    return <p className="text-sm text-neutral-500">Loading...</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {errorMessage && (
        <div className="rounded-md border-l-4 border-error-600 bg-error-100 px-4 py-3 text-sm text-error-700">
          {errorMessage}
        </div>
      )}

      {isSignedIn ? (
        <button
          type="button"
          disabled={joining}
          onClick={handleJoinAsSignedIn}
          className="rounded-md bg-primary-600 px-4 py-3.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
        >
          {joining ? "Joining..." : `Join ${tenantName}`}
        </button>
      ) : (
        <>
          <Link
            href={`/sign-up?type=member&invite=${token}`}
            className="inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-3.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
          >
            Create your account & join
          </Link>
          <Link
            href={`/sign-in?redirect_url=${encodeURIComponent(`/invite/${token}`)}`}
            className="inline-flex items-center justify-center rounded-md border border-neutral-300 px-4 py-3.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
          >
            Already have an account? Sign in
          </Link>
        </>
      )}
    </div>
  );
}
