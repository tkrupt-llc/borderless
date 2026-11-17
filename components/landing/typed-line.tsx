"use client";

import { useEffect, useRef, useState } from "react";

/** The closing line types itself once when it scrolls into view (design canvas). */
export function TypedLine() {
  const ref = useRef<HTMLParagraphElement>(null);
  const [state, setState] = useState<"" | "pretype" | "typing">("");
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const arm = setTimeout(() => setState((s) => (s === "" ? "pretype" : s)), 0);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState("typing");
          io.disconnect();
        }
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      clearTimeout(arm);
      io.disconnect();
    };
  }, []);
  return (
    <p ref={ref} className="max-w-[18ch] font-serif text-[clamp(30px,4.4vw,52px)] leading-[1.15] font-normal">
      <span className={state}>
        …because waiting with no news is the <em className="text-primary">hardest part.</em>
      </span>
      <span className="caret" aria-hidden="true" />
    </p>
  );
}
