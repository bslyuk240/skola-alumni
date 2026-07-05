"use client";

import type { KeyboardEvent } from "react";

/**
 * Toggle Switch, per UI/UX Design Brief section 3.9.
 *
 * Uses a <div role="switch"> instead of a native <button> — Chrome's native button box gives
 * absolutely-positioned children a skewed "static position" fallback (confirmed via direct
 * measurement: an identically-classed <button> child renders ~20px further right than the same
 * child in a <div>, even with an explicit left-0), which visibly broke the knob's on/off position.
 */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  function toggle() {
    if (!disabled) onChange(!checked);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle();
    }
  }

  return (
    <div
      role="switch"
      tabIndex={disabled ? -1 : 0}
      aria-checked={checked}
      aria-label={label}
      aria-disabled={disabled}
      onClick={toggle}
      onKeyDown={handleKeyDown}
      className={`relative h-5 w-10 shrink-0 rounded-full ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      }`}
      style={{
        backgroundColor: checked ? "var(--color-success-600)" : "var(--color-neutral-300)",
        transition: "background-color 150ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <span
        className="absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white"
        style={{
          transform: checked ? "translateX(22px)" : "translateX(2px)",
          transition: "transform 150ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />
    </div>
  );
}
