"use client";

import type { ReactNode } from "react";

const STEP_LABELS = ["Identity", "Bank Details", "Plan"];

export function OnboardingShell({
  step,
  eyebrow,
  title,
  subtitle,
  children,
}: {
  step: 1 | 2 | 3;
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-primary-900">
      <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col">
        <div className="flex flex-col gap-2 px-6 pb-8 pt-6 text-white">
          <div className="flex items-center gap-2">
            {STEP_LABELS.map((label, index) => {
              const stepNumber = (index + 1) as 1 | 2 | 3;
              const isActive = stepNumber === step;
              const isDone = stepNumber < step;
              return (
                <div key={label} className="flex flex-1 flex-col gap-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-colors ${
                      isActive || isDone ? "bg-secondary-500" : "bg-white/20"
                    }`}
                  />
                  <span
                    className={`text-[11px] font-medium ${isActive ? "text-white" : "text-white/50"}`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>

          <span className="mt-3 text-xs font-semibold uppercase tracking-widest text-white/50">
            {eyebrow}
          </span>
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
