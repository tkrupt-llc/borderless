"use client";

import { useSyncExternalStore } from "react";
import en from "@/content/i18n/en.json";

// Discreet mode is a per-device preference, kept in localStorage so it survives
// Quick exit (which clears answers, not settings). Every access tolerates blocked storage.
const KEY = "bl.discreet";
const EVENT = "bl-discreet";
export const DISCREET_TITLE = en.app.discreetTitle;
export const NEUTRAL_ICON = "/neutral-icon.svg";

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setDiscreet(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    // storage blocked: applies to this page view only
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useDiscreet(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}

export function isDiscreet(): boolean {
  return read();
}
