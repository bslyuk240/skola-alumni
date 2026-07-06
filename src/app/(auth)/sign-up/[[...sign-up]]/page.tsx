"use client";

import {
  useState,
  useEffect,
  useMemo,
  useRef,
  type FormEvent,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useClerk } from "@clerk/nextjs";
import { useSignUp } from "@clerk/nextjs/legacy";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { ArrowLeft } from "lucide-react";
import { slugify } from "@/lib/slug";

type Intent = "tenant" | "member";

const RESEND_COOLDOWN_SECONDS = 30;
const OTP_LENGTH = 6;

function useResendCooldown() {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  return { secondsLeft, start: () => setSecondsLeft(RESEND_COOLDOWN_SECONDS) };
}

/** Full-bleed navy hero + white bottom-sheet — the shared shell for every pre-auth screen. */
function AuthShell({
  eyebrow,
  title,
  subtitle,
  onBack,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-primary-900">
      <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col">
        <div className="flex flex-col gap-2 px-6 pb-8 pt-6 text-white">
          <div className="flex h-6 items-center">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="Go back"
                className="-ml-2 flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
          </div>
          <span className="text-xs font-semibold uppercase tracking-widest text-white/50">{eyebrow}</span>
          <h1 className="text-2xl font-bold leading-tight">{title}</h1>
          <p className="text-sm text-white/70">{subtitle}</p>
        </div>

        <div className="flex flex-1 flex-col rounded-t-[28px] bg-white px-6 pb-10 pt-8 shadow-lg">
          {children}
        </div>
      </div>
    </main>
  );
}

function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 rounded-md border-l-4 border-error-600 bg-error-100 px-4 py-3 text-sm text-error-700">
      {children}
    </div>
  );
}

function Field({
  label,
  helper,
  index,
  children,
}: {
  label: string;
  helper?: string;
  index: number;
  children: ReactNode;
}) {
  return (
    <label
      className="animate-rise flex flex-col gap-1.5 text-sm"
      style={{ "--rise-index": index } as React.CSSProperties}
    >
      <span className="font-medium text-neutral-700">{label}</span>
      {children}
      {helper && <span className="text-xs text-neutral-500">{helper}</span>}
    </label>
  );
}

export default function SignUpPage() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const router = useRouter();
  const searchParams = useSearchParams();
  const intent: Intent = searchParams.get("type") === "member" ? "member" : "tenant";
  const schoolSlug = searchParams.get("school");
  const [signingOut, setSigningOut] = useState(false);

  const [step, setStep] = useState<"form" | "verify">("form");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [slugOverride, setSlugOverride] = useState<string | null>(null);
  const [graduationYear, setGraduationYear] = useState("");
  const [code, setCode] = useState("");

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { secondsLeft, start } = useResendCooldown();

  const slug = slugOverride ?? slugify(schoolName);
  const missingSchoolSelection = intent === "member" && !schoolSlug;

  function setOtpDigit(index: number, rawValue: string) {
    const digit = rawValue.replace(/\D/g, "").slice(-1);
    const digits = Array.from({ length: OTP_LENGTH }, (_, i) => code[i] ?? "");
    digits[index] = digit;
    setCode(digits.join(""));
    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !code[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    event.preventDefault();
    setCode(pasted);
    otpRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  }

  async function handleCreateAccount(event: FormEvent) {
    event.preventDefault();
    if (!isLoaded || !signUp) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      await signUp.create({ emailAddress: email, password, firstName, lastName });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      start();
      setStep("verify");
    } catch (error) {
      setErrorMessage(
        isClerkAPIResponseError(error) && error.errors[0]
          ? error.errors[0].longMessage ?? error.errors[0].message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyCode(event: FormEvent) {
    event.preventDefault();
    if (!isLoaded || !signUp) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await signUp.attemptEmailAddressVerification({ code });

      if (result.status !== "complete" || !result.createdSessionId) {
        setErrorMessage("Incorrect code. Please check your spam folder or try again.");
        setSubmitting(false);
        return;
      }

      await setActive({ session: result.createdSessionId });

      await postJson("/api/auth/register", {
        firstName,
        lastName,
        graduationYear: graduationYear ? Number(graduationYear) : undefined,
      });

      if (intent === "tenant") {
        const tenant = await postJson<{ slug: string }>("/api/tenants", { name: schoolName, slug });
        router.push(`/onboarding/step-1?tenant=${tenant.slug}`);
      } else if (schoolSlug) {
        await postJson(`/api/tenants/${schoolSlug}/join`, {});
        router.push(`/${schoolSlug}/home`);
      }
    } catch (error) {
      setErrorMessage(
        isClerkAPIResponseError(error) && error.errors[0]
          ? error.errors[0].longMessage ?? error.errors[0].message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const title = useMemo(
    () => (intent === "tenant" ? "Register your association" : "Request to join"),
    [intent]
  );

  if (authLoaded && isSignedIn) {
    return (
      <AuthShell
        eyebrow={intent === "tenant" ? "New Association" : "Join Association"}
        title="You're already signed in"
        subtitle="Continue to your workspace, or sign out to register a different account."
      >
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => router.push("/select-workspace")}
            className="animate-rise rounded-md bg-primary-600 px-4 py-3.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
            style={{ "--rise-index": 0 } as React.CSSProperties}
          >
            Continue to your workspace
          </button>
          <button
            type="button"
            disabled={signingOut}
            onClick={async () => {
              setSigningOut(true);
              await signOut();
              setSigningOut(false);
            }}
            className="animate-rise rounded-md border border-neutral-300 px-4 py-3.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-500"
            style={{ "--rise-index": 1 } as React.CSSProperties}
          >
            {signingOut ? "Signing out..." : "Sign out and create a new account"}
          </button>
        </div>
      </AuthShell>
    );
  }

  if (missingSchoolSelection) {
    return (
      <AuthShell
        eyebrow="Join Association"
        title="Choose a school first"
        subtitle="Browse the directory and select an association to request access."
      >
        <Link
          href="/explore-schools"
          className="animate-rise mt-2 inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-3 text-sm font-medium text-white hover:bg-primary-700"
          style={{ "--rise-index": 0 } as React.CSSProperties}
        >
          Browse Schools
        </Link>
      </AuthShell>
    );
  }

  if (step === "verify") {
    return (
      <AuthShell
        eyebrow={intent === "tenant" ? "New Association" : "Join Association"}
        title="Verify your email"
        subtitle={`Enter the ${OTP_LENGTH}-digit code we sent to ${email}`}
        onBack={() => setStep("form")}
      >
        {errorMessage && <ErrorBanner>{errorMessage}</ErrorBanner>}

        <form onSubmit={handleVerifyCode} className="flex flex-col gap-6">
          <div className="animate-rise flex justify-between gap-2" style={{ "--rise-index": 0 } as React.CSSProperties}>
            {Array.from({ length: OTP_LENGTH }).map((_, index) => (
              <input
                key={index}
                ref={(el) => {
                  otpRefs.current[index] = el;
                }}
                inputMode="numeric"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                maxLength={1}
                value={code[index] ?? ""}
                onChange={(e) => setOtpDigit(index, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(index, e)}
                onPaste={handleOtpPaste}
                className="input h-14 w-full px-0 text-center text-xl font-semibold"
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={submitting || code.length < OTP_LENGTH}
            className="animate-rise rounded-md bg-primary-600 px-4 py-3.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
            style={{ "--rise-index": 1 } as React.CSSProperties}
          >
            {submitting ? "Verifying..." : "Verify & Continue"}
          </button>

          <button
            type="button"
            disabled={secondsLeft > 0}
            onClick={async () => {
              await signUp?.prepareEmailAddressVerification({ strategy: "email_code" });
              start();
            }}
            className="animate-rise text-center text-xs font-medium text-primary-600 disabled:text-neutral-500"
            style={{ "--rise-index": 2 } as React.CSSProperties}
          >
            {secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : "Resend code"}
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow={intent === "tenant" ? "New Association" : "Join Association"}
      title={title}
      subtitle={
        intent === "tenant"
          ? "Set up your school's private workspace in minutes."
          : "Tell us a bit about yourself to request access."
      }
    >
      {errorMessage && <ErrorBanner>{errorMessage}</ErrorBanner>}

      <form onSubmit={handleCreateAccount} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First Name" index={0}>
            <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input" />
          </Field>
          <Field label="Last Name" index={1}>
            <input required value={lastName} onChange={(e) => setLastName(e.target.value)} className="input" />
          </Field>
        </div>

        <Field label="Email Address" index={2}>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </Field>

        <Field label="Password" index={3}>
          <input
            required
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </Field>

        {intent === "tenant" ? (
          <>
            <Field label="School / Association Name" index={4}>
              <input
                required
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Workspace URL" helper={`skolaalumni.app/${slug || "your-slug"}`} index={5}>
              <input
                required
                value={slug}
                onChange={(e) => setSlugOverride(slugify(e.target.value))}
                className="input"
              />
            </Field>
          </>
        ) : (
          <Field label="Graduation Class Year" helper="Optional" index={4}>
            <input
              type="number"
              value={graduationYear}
              onChange={(e) => setGraduationYear(e.target.value)}
              className="input"
            />
          </Field>
        )}

        <div id="clerk-captcha" />

        <button
          type="submit"
          disabled={submitting}
          className="animate-rise mt-2 rounded-md bg-primary-600 px-4 py-3.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
          style={{ "--rise-index": 6 } as React.CSSProperties}
        >
          {submitting ? "Creating account..." : intent === "tenant" ? "Register Association" : "Request to Join Association"}
        </button>

        <p className="text-center text-xs text-neutral-500">
          By continuing, you agree to our{" "}
          <Link href="/legal/terms" className="text-primary-600 hover:underline">
            Terms
          </Link>
          ,{" "}
          <Link href="/legal/privacy" className="text-primary-600 hover:underline">
            Privacy Policy
          </Link>
          , and{" "}
          <Link href="/legal/billing" className="text-primary-600 hover:underline">
            Billing Policy
          </Link>
          .
        </p>
      </form>
    </AuthShell>
  );
}

async function postJson<T = unknown>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? `Request to ${url} failed`);
  }

  return response.json();
}
