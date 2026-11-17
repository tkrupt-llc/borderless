// The follow-up link remembered on this device, only if the person chooses
// "Remember on this device". Used by /home to offer one next step.
export const DEVICE_KEY = "bl_follow_up";
export type RememberedFollowUp = { token: string; due: string };

export function readRemembered(): RememberedFollowUp | null {
  try {
    const raw = localStorage.getItem(DEVICE_KEY);
    return raw ? (JSON.parse(raw) as RememberedFollowUp) : null;
  } catch {
    return null;
  }
}

export function remember(value: RememberedFollowUp): boolean {
  try {
    localStorage.setItem(DEVICE_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function forget() {
  try {
    localStorage.removeItem(DEVICE_KEY);
  } catch {}
}
