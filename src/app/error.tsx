"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error boundary]", error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 bg-primary-900 px-6 py-12 text-center text-white">
      <AlertTriangle className="h-10 w-10 text-secondary-500" strokeWidth={1.5} />
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="max-w-xs text-sm text-white/70">
        We hit an unexpected error. Try again, and if it keeps happening, let your administrator know.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium hover:bg-primary-700"
      >
        Try Again
      </button>
    </main>
  );
}
