"use client";

import { useEffect } from "react";
import { DISCREET_TITLE, NEUTRAL_ICON, useDiscreet } from "@/lib/discreet";

/**
 * In discreet mode, keeps the tab title "Wellbeing check" and the icon neutral.
 * Next.js rewrites the title on navigation, so a MutationObserver puts it back.
 */
export function DiscreetTitle() {
  const on = useDiscreet();

  useEffect(() => {
    if (!on) return;
    const original = document.title;
    const icons = [...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')];
    const originalIcons = icons.map((l) => l.href);

    const apply = () => {
      if (document.title !== DISCREET_TITLE) document.title = DISCREET_TITLE;
      document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]').forEach((l) => {
        if (!l.href.endsWith(NEUTRAL_ICON)) l.href = NEUTRAL_ICON;
      });
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true, attributes: true });

    return () => {
      observer.disconnect();
      document.title = original;
      icons.forEach((l, i) => (l.href = originalIcons[i]));
    };
  }, [on]);

  return null;
}
