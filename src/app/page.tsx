import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LandingCarousel } from "./_components/landing-carousel";

// A returning visitor with an active session should never see the pre-signup carousel again —
// send them straight into their workspace (select-workspace resolves where that actually is).
export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/select-workspace");

  return <LandingCarousel />;
}
