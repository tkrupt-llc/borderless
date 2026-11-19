import config from "@/content/rules/staffing.json";

/**
 * Staffed hours (content/rules/staffing.json, UAE time). Pure, so it is tested
 * on its own. Hours are [start, end) in whole hours; a day missing from the
 * config is closed.
 */

export type Staffing = { timezone: string; hours: Partial<Record<Day, [number, number] | number[]>> };
type Day = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
const DAYS: Day[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
export const STAFFING: Staffing = config as Staffing;

/** Day of week (0 = Sunday) and the hour and minute in the configured time zone. */
function local(at: Date, tz: string): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return {
    day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")),
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

export function isStaffed(at: Date, cfg: Staffing = STAFFING): boolean {
  const { day, minutes } = local(at, cfg.timezone);
  const h = cfg.hours[DAYS[day]];
  return Boolean(h) && minutes >= h![0] * 60 && minutes < h![1] * 60;
}

/** When the team is next on duty (now, if staffed). Looks up to a week ahead. */
export function nextStaffed(at: Date, cfg: Staffing = STAFFING): Date {
  if (isStaffed(at, cfg)) return at;
  // Step forward a minute at a time to the next opening; at most 7 days.
  const { minutes } = local(at, cfg.timezone);
  let t = new Date(at.getTime() + (60 - (minutes % 60)) * 60_000 - (at.getUTCSeconds() * 1000 + at.getUTCMilliseconds()));
  for (let i = 0; i < 7 * 24; i++, t = new Date(t.getTime() + 3_600_000)) if (isStaffed(t, cfg)) return t;
  return t;
}

/** "Our team is offline until Thu 8:00 am" style time, in the configured zone. */
export function formatOpening(at: Date, cfg: Staffing = STAFFING): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: cfg.timezone, weekday: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(at);
}
