import { redirect } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { getPlatformAdminUser } from "@/lib/platform-access";

const INTEGRATIONS = [
  {
    name: "Paystack",
    description: "Subscription checkout and payment verification.",
    configured: Boolean(process.env.PAYSTACK_SECRET_KEY && process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY),
  },
  {
    name: "Cloudinary",
    description: "Logo, avatar, post-media, and receipt uploads.",
    configured: Boolean(
      process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_SECRET
    ),
  },
  {
    name: "Resend",
    description: "Transactional emails — welcome, payment confirmations.",
    configured: Boolean(process.env.RESEND_API_KEY),
  },
  {
    name: "Firebase (FCM)",
    description: "Push notifications for announcements and dues.",
    configured: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON && process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY),
  },
];

export default async function PlatformIntegrationsPage() {
  const admin = await getPlatformAdminUser();
  if (!admin) redirect("/");

  return (
    <main className="flex-1 px-6 py-6">
      <h1 className="text-xl font-semibold text-neutral-900">Integrations</h1>
      <p className="text-sm text-neutral-500">
        Read-only status of the third-party services this deployment depends on, checked against
        environment configuration.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {INTEGRATIONS.map((integration) => (
          <div
            key={integration.name}
            className="flex flex-col gap-2 rounded-lg border border-neutral-100 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-900">{integration.name}</h2>
              {integration.configured ? (
                <CheckCircle2 className="h-5 w-5 text-success-600" strokeWidth={1.75} />
              ) : (
                <XCircle className="h-5 w-5 text-error-600" strokeWidth={1.75} />
              )}
            </div>
            <p className="text-xs text-neutral-500">{integration.description}</p>
            <span
              className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${
                integration.configured ? "bg-success-100 text-success-700" : "bg-error-100 text-error-700"
              }`}
            >
              {integration.configured ? "Configured" : "Missing config"}
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}
