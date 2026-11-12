import { Suspense } from "react";
import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { DiscreetTitle } from "@/components/discreet-title";
import { NavTracker } from "@/components/back-button";
import "./globals.css";

// Headings: Fraunces (one italic accent word per heading). Body and UI: Inter.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// The tab never says "mental health". In discreet mode (components/discreet-title)
// the title switches to the fully neutral "Wellbeing check" from content/i18n.
export const metadata: Metadata = {
  title: "Borderless",
  description: "Borderless",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" dir="ltr" className={`${fraunces.variable} ${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <DiscreetTitle />
        {/* Reads the URL, so it sits behind Suspense and never blocks the page. */}
        <Suspense>
          <NavTracker />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
