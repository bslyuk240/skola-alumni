import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 bg-primary-900 px-6 py-12 text-center text-white">
      <WifiOff className="h-10 w-10 text-white/70" strokeWidth={1.5} />
      <h1 className="text-lg font-semibold">You&rsquo;re offline</h1>
      <p className="max-w-xs text-sm text-white/70">
        Skola Alumni needs an internet connection. Reconnect and try again — anything you were
        viewing will still be here.
      </p>
    </main>
  );
}
