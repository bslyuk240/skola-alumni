import { SignIn } from "@clerk/nextjs";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const { redirect_url: redirectUrl } = await searchParams;
  const safeRedirect =
    redirectUrl && redirectUrl.startsWith("/") && !redirectUrl.startsWith("//")
      ? redirectUrl
      : "/select-workspace";

  return (
    <main className="flex flex-1 items-center justify-center bg-neutral-50 py-12">
      <SignIn
        fallbackRedirectUrl={safeRedirect}
        forceRedirectUrl={redirectUrl ? safeRedirect : undefined}
        signUpUrl="/sign-up"
      />
    </main>
  );
}
