import { redirect } from "next/navigation";
import { getPlatformAdminUser } from "@/lib/platform-access";
import { PlatformSidebar } from "./_components/platform-sidebar";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const user = await getPlatformAdminUser();

  if (!user) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen">
      <PlatformSidebar />
      <div className="flex flex-1 flex-col bg-neutral-50">{children}</div>
    </div>
  );
}
