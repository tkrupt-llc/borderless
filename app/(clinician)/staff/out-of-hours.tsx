"use client";

import { useEffect, useState } from "react";
import { formatOpening, isStaffed, nextStaffed } from "@/lib/staffing";

/** "Out of hours" in the console top bar when the team is outside its staffed hours (UAE time). */
export function OutOfHours() {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setLabel(isStaffed(now) ? null : `Out of hours · team back ${formatOpening(nextStaffed(now))}`);
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);
  if (!label) return null;
  return (
    <span role="status" className="rounded-md border border-[#e3c27a] bg-[#fbefd2] px-2 py-0.5 text-[0.8125rem] font-semibold text-[#5c3a00]">
      {label}
    </span>
  );
}
