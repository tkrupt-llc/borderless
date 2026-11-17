"use client";

import { useEffect, useState } from "react";
import { loadMyTrend, type MyTrend as Trend } from "../../actions";
import { seriesFrom, TrendChart } from "@/components/trend-chart";

/** After a follow-up: this person's scores over their check-ins, from the server, for this browser's session only. */
export function MyTrend() {
  const [trend, setTrend] = useState<Trend | null | undefined>(undefined);
  useEffect(() => {
    loadMyTrend().then(setTrend, () => setTrend(null));
  }, []);

  if (trend === undefined) return <p className="text-caption text-muted">Loading how things have changed…</p>;
  if (!trend || trend.checkIns < 2) return null;
  const series = seriesFrom(trend.points);
  if (series.length === 0) return null;

  return (
    <section aria-labelledby="trend-h" className="flex flex-col gap-4 rounded-2xl bg-surface px-4 py-4">
      <div>
        <h2 id="trend-h" className="font-semibold">
          How things have changed
        </h2>
        <p className="text-caption text-text-2">Across your {trend.checkIns} check-ins. These are not a diagnosis; your clinician will look at them with you.</p>
      </div>
      {series.map((s) => (
        <TrendChart key={s.title} series={s} />
      ))}
    </section>
  );
}
