import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-neutral-50 py-12">
      <SignIn fallbackRedirectUrl="/select-workspace" signUpUrl="/sign-up" />
    </main>
  );
}
