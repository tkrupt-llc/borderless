"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

const LINKS = [
  { href: "/return", label: "Coming back?" },
  { href: "#how", label: "How it works" },
  { href: "#safe", label: "Why it's safe" },
  { href: "#clinicians", label: "For clinicians" },
  { href: "/staff/login", label: "Care team sign-in" },
];

/**
 * Landing header on phones (under 768px): a compact "Check in" button and a menu button.
 * The menu is a full-width panel under the header. It closes on a link tap, Escape or a tap
 * outside; focus moves to the first link when it opens and back to the button on Escape.
 */
export function MobileMenu({ startHref }: { startHref: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div className="flex shrink-0 items-center gap-2 md:hidden">
      <Link
        href={startHref}
        className="tap inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-[1rem] font-medium whitespace-nowrap text-white no-underline hover:text-white"
      >
        Check in
      </Link>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="tap grid size-11 cursor-pointer place-items-center rounded-full border-[1.5px] border-line bg-surface text-ink"
      >
        <span className="sr-only">{open ? "Close menu" : "Menu"}</span>
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
          {open ? (
            <path d="M5 5l12 12M17 5L5 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          ) : (
            <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          )}
        </svg>
      </button>
      <div
        ref={panel}
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full z-30 border-y border-line bg-surface shadow-[0_12px_24px_rgba(31,42,28,0.10)]"
      >
        <nav aria-label="Main" className="flex flex-col px-5 py-2">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="flex min-h-12 items-center border-b border-line-warm text-[1.0625rem] text-ink no-underline last:border-b-0 hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
