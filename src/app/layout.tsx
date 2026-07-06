import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { PwaInstallBanner } from "@/components/pwa-install-banner";
import { PwaUpdateBanner } from "@/components/pwa-update-banner";
import { ChangelogBanner } from "@/components/changelog-banner";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// Runs before hydration so the correct theme is applied on first paint — avoids a flash of the
// wrong theme, since ThemeProvider's own effect only runs after React mounts.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var theme = localStorage.getItem("skola-theme") || "light";
    var isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
  } catch (e) {}
})();
`;

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Skola Alumni",
  description:
    "The private database, dues collector, and structure your alumni association needs to run alongside WhatsApp.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${inter.variable} h-full antialiased`}>
        <head>
          <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        </head>
        <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900">
          <ThemeProvider>
            {children}
            <PwaUpdateBanner />
            <PwaInstallBanner />
            <ChangelogBanner />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
