"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// How many of our own pages sit behind this one in this tab's history, so Back
// knows whether the previous entry is one of our pages or something outside
// the site (a new-tab page, a search result). Mounted once in the root layout.
// A link adds one; a browser Back/Forward (popstate) takes one away. A Forward
// is rare and only makes Back fall back to the home page early, never leave the site.
let depth = 0;
let lastPath: string | null = null;
let poppedHistory = false;

export function NavTracker() {
  const pathname = usePathname();
  useEffect(() => {
    const onPop = () => {
      poppedHistory = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    // Only a real change of page counts (React may run this effect twice in development).
    if (lastPath !== null && lastPath !== pathname) {
      depth = poppedHistory ? Math.max(0, depth - 1) : depth + 1;
    }
    lastPath = pathname;
    poppedHistory = false;
  }, [pathname]);
  return null;
}

/**
 * Behaves like the browser's Back while there is an earlier page of ours in
 * this tab; otherwise goes to `fallback`, so Back never leaves the site or
 * does nothing.
 */
export function BackButton({
  fallback,
  className,
  children,
}: {
  fallback: string;
  className: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Back"
      onClick={() => (depth > 0 ? router.back() : router.push(fallback))}
      className={className}
    >
      {children}
    </button>
  );
}
