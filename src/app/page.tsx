"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Building2, Wallet, Users, Rocket, type LucideIcon } from "lucide-react";

interface Slide {
  Icon: LucideIcon;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    Icon: Building2,
    title: "One Home For Your Alumni Association",
    body: "Move beyond scattered WhatsApp groups and spreadsheets into a single, structured workspace.",
  },
  {
    Icon: Wallet,
    title: "Track Dues Without The Spreadsheet Chaos",
    body: "Members upload payment receipts, treasurers verify them, and every transaction is logged automatically.",
  },
  {
    Icon: Users,
    title: "Class Sets & Regional Chapters, Sandboxed",
    body: "Every class year and diaspora chapter gets its own feed, dues, and admins — without cluttering the main association.",
  },
];

export default function LandingPage() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const totalSlides = SLIDES.length + 1; // + final CTA slide

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const index = slideRefs.current.findIndex((el) => el === entry.target);
            if (index !== -1) setActiveIndex(index);
          }
        }
      },
      { root: scroller, threshold: 0.6 }
    );

    for (const el of slideRefs.current) {
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  function goToSlide(index: number) {
    slideRefs.current[index]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  return (
    <main className="flex flex-1 flex-col bg-primary-900 text-white">
      <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col">
        <div className="flex items-center justify-between px-6 pt-6">
          <span className="text-xs font-semibold uppercase tracking-widest text-white/50">
            Skola Alumni
          </span>
          {activeIndex < totalSlides - 1 && (
            <button
              type="button"
              onClick={() => goToSlide(totalSlides - 1)}
              className="text-xs font-medium text-white/70 hover:text-white"
            >
              Skip
            </button>
          )}
        </div>

        <div
          ref={scrollerRef}
          className="mt-4 flex flex-1 snap-x snap-mandatory overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {SLIDES.map((slide, index) => (
            <div
              key={slide.title}
              ref={(el) => {
                slideRefs.current[index] = el;
              }}
              className="flex w-full flex-shrink-0 snap-center flex-col items-center justify-center px-8 text-center"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10">
                <slide.Icon className="h-9 w-9 text-secondary-500" strokeWidth={1.5} />
              </div>
              <h1 className="mt-8 text-2xl font-bold leading-tight">{slide.title}</h1>
              <p className="mt-3 text-sm text-white/70">{slide.body}</p>
            </div>
          ))}

          <div
            ref={(el) => {
              slideRefs.current[SLIDES.length] = el;
            }}
            className="flex w-full flex-shrink-0 snap-center flex-col items-center justify-center px-8 text-center"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10">
              <Rocket className="h-9 w-9 text-secondary-500" strokeWidth={1.5} />
            </div>
            <h1 className="mt-8 text-2xl font-bold leading-tight">Ready to get started?</h1>
            <p className="mt-3 text-sm text-white/70">
              Register your association, or join one that&rsquo;s already on Skola Alumni.
            </p>

            <div className="mt-6 flex w-full flex-col gap-3">
              <Link
                href="/sign-up?type=tenant"
                className="rounded-md bg-primary-600 px-6 py-3 text-sm font-medium hover:bg-primary-700 transition-colors"
              >
                Register Your Alumni Association
              </Link>
              <Link
                href="/explore-schools"
                className="rounded-md border border-white/30 px-6 py-3 text-sm font-medium hover:bg-white/10 transition-colors"
              >
                Join Your School Alumni Space
              </Link>
              <Link href="/sign-in" className="mt-1 text-sm font-medium text-white/70 hover:text-white">
                Already have an account? Sign in
              </Link>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 pb-8 pt-4">
          {Array.from({ length: totalSlides }).map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => goToSlide(index)}
              aria-label={`Go to slide ${index + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                index === activeIndex ? "w-6 bg-secondary-500" : "w-1.5 bg-white/30"
              }`}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
