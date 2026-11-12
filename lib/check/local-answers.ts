"use client";

import { useSyncExternalStore } from "react";

// In-progress answers live in this tab only (sessionStorage) until the database
// is wired; Quick exit clears them. Every read and write tolerates blocked storage.
const EVENT = "borderless-storage";
const key = (path: string) => `borderless.answers.${path}`;
export const SUBMITTED_AT_KEY = "borderless.submittedAt";

function read(k: string): string | null {
  try {
    return sessionStorage.getItem(k);
  } catch {
    return null;
  }
}

function write(k: string, value: string) {
  try {
    sessionStorage.setItem(k, value);
  } catch {
    // storage blocked: the flow still works for this page view
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

export function getAnswers(path: string): Record<string, number> {
  try {
    return JSON.parse(read(key(path)) ?? "{}");
  } catch {
    return {};
  }
}

export function saveAnswer(path: string, itemId: string, value: number) {
  const answers = { ...getAnswers(path), [itemId]: value };
  write(key(path), JSON.stringify(answers));
  return answers;
}

export function clearAnswers(path: string) {
  try {
    sessionStorage.removeItem(key(path));
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(EVENT));
}

export const RESULT_KEY = "borderless.result";

/** Keeps the finished check-in's scores for the result card, then clears the answers. */
export function markSubmitted(path: string, result: unknown) {
  write(SUBMITTED_AT_KEY, new Date().toISOString());
  write(RESULT_KEY, JSON.stringify({ path, ...(result as object) }));
  clearAnswers(path);
}

/** Merges extra fields (e.g. the follow-up choice) into the stored result. */
export function updateStoredResult(patch: Record<string, unknown>) {
  let current: Record<string, unknown> = {};
  try {
    current = JSON.parse(read(RESULT_KEY) ?? "{}");
  } catch {
    // start fresh
  }
  write(RESULT_KEY, JSON.stringify({ ...current, ...patch }));
}

/** The stored answer for one item, or undefined. Server render: undefined. */
export function useStoredAnswer(path: string, itemId: string): number | undefined {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(key(path)),
    () => null,
  );
  if (!raw) return undefined;
  try {
    return JSON.parse(raw)[itemId];
  } catch {
    return undefined;
  }
}

export function useStoredValue(k: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => read(k),
    () => null,
  );
}
