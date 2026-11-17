"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { imminentAlerts } from "./actions";
import { caseRef } from "@/lib/case-ref";

type Alert = { id: string; sessionId: string; createdAt: string };
const ENABLED_KEY = "bl_console_alerts";
const POLL_MS = 10_000;

/** A short two-note tone made in the browser (no audio file). */
function chime(ctx: AudioContext) {
  const now = ctx.currentTime;
  [880, 660].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.0001, now + i * 0.22);
    gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.22 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.22 + 0.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + i * 0.22);
    osc.stop(now + i * 0.22 + 0.22);
  });
}

/**
 * Watches for imminent cases on every console page. A new one plays a tone,
 * shows a browser notification (if allowed) and puts a count in the tab title,
 * so a clinician working in another tab does not miss it. Sound needs one click
 * first (browsers require it), hence "Turn on alerts".
 */
export function ImminentAlert() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [enabled, setEnabled] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const audio = useRef<AudioContext | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(ENABLED_KEY) === "on") setTimeout(() => setEnabled(true), 0);
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const list = await imminentAlerts().catch(() => null);
      if (cancelled || !list) return;
      setAlerts(list);
      // The first read only records what is already there; later reads alert on anything new.
      if (seen.current === null) {
        seen.current = new Set(list.map((a) => a.id));
        return;
      }
      const fresh = list.filter((a) => !seen.current!.has(a.id));
      fresh.forEach((a) => seen.current!.add(a.id));
      if (fresh.length === 0 || !enabled) return;
      if (audio.current) {
        audio.current.resume().then(() => chime(audio.current!)).catch(() => {});
      }
      if ("Notification" in window && Notification.permission === "granted") {
        const n = new Notification("Imminent case", {
          body: `${caseRef(fresh[0].sessionId)} needs a response within 15 minutes.`,
          tag: "borderless-imminent",
        });
        n.onclick = () => {
          window.focus();
          router.push(`/staff/case/${fresh[0].sessionId}`);
        };
      }
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, router]);

  // Tab title shows the count of imminent cases waiting. The console re-renders
  // every few seconds (which resets the title), so the count is put back whenever
  // the title changes.
  useEffect(() => {
    const strip = (t: string) => t.replace(/^\(\d+\) Imminent · /, "");
    const apply = () => {
      const base = strip(document.title);
      const want = alerts.length > 0 ? `(${alerts.length}) Imminent · ${base}` : base;
      if (document.title !== want) document.title = want;
    };
    apply();
    const titleEl = document.querySelector("title");
    const observer = new MutationObserver(apply);
    if (titleEl) observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    observer.observe(document.head, { childList: true });
    return () => {
      observer.disconnect();
      document.title = strip(document.title);
    };
  }, [alerts]);

  const turnOn = async () => {
    try {
      audio.current ??= new AudioContext();
      await audio.current.resume();
      chime(audio.current);
    } catch {}
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission().catch(() => {});
    }
    try {
      localStorage.setItem(ENABLED_KEY, "on");
    } catch {}
    setEnabled(true);
  };

  const turnOff = () => {
    try {
      localStorage.removeItem(ENABLED_KEY);
    } catch {}
    setEnabled(false);
  };

  // Turned on in an earlier visit: the audio context still needs a click to start, which any click provides.
  useEffect(() => {
    if (!enabled || audio.current) return;
    const start = () => {
      try {
        audio.current ??= new AudioContext();
        audio.current.resume().catch(() => {});
      } catch {}
    };
    window.addEventListener("pointerdown", start, { once: true });
    return () => window.removeEventListener("pointerdown", start);
  }, [enabled]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {alerts.length > 0 && (
        <Link
          href={`/staff/case/${alerts[0].sessionId}`}
          role="status"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-danger px-3 text-[0.8125rem] font-semibold text-white no-underline hover:text-white"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" fill="currentColor">
            <path d="M5 0.5 9.8 9.5H0.2z" />
          </svg>
          {alerts.length} imminent · open {caseRef(alerts[0].sessionId)}
        </Link>
      )}
      {enabled ? (
        <button
          type="button"
          onClick={turnOff}
          className="min-h-9 cursor-pointer rounded-lg px-2 text-[0.8125rem] text-muted underline underline-offset-2 hover:text-ink"
        >
          Alerts on · turn off
        </button>
      ) : (
        <button
          type="button"
          onClick={turnOn}
          className="min-h-9 cursor-pointer rounded-lg border border-line bg-surface px-3 text-[0.8125rem] font-medium text-ink hover:bg-sage-soft"
        >
          Turn on alerts
        </button>
      )}
    </div>
  );
}
