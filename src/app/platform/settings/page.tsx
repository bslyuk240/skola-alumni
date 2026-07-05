import { redirect } from "next/navigation";
import { getPlatformAdminUser } from "@/lib/platform-access";
import { getPlatformSettings } from "@/lib/platform-settings";
import { SettingsForm } from "./_components/settings-form";

export default async function PlatformSettingsPage() {
  const admin = await getPlatformAdminUser();
  if (!admin) redirect("/");

  const settings = await getPlatformSettings();

  return (
    <main className="flex-1 px-6 py-6">
      <h1 className="text-xl font-semibold text-neutral-900">Platform Settings</h1>
      <p className="text-sm text-neutral-500">
        Global defaults applied to every tenant — changes affect new signups and future billing
        checks, not retroactively.
      </p>

      <div className="mt-4 max-w-md">
        <SettingsForm trialDays={settings.trialDays} gracePeriodDays={settings.gracePeriodDays} />
      </div>
    </main>
  );
}
