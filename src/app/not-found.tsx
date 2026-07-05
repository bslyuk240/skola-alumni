import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 bg-primary-900 px-6 py-12 text-center text-white">
      <Compass className="h-10 w-10 text-white/70" strokeWidth={1.5} />
      <h1 className="text-lg font-semibold">Page Not Found</h1>
      <p className="max-w-xs text-sm text-white/70">
        The page you&rsquo;re looking for doesn&rsquo;t exist or may have been moved.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium hover:bg-primary-700"
      >
        Back to Home
      </Link>
    </main>
  );
}
