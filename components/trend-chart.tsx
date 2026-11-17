// Score over time for one questionnaire: one series, so no legend (the title
// names it). Thin line, round markers, value labels on the points, recessive
// grid, and a table for screen readers. Lower is better on every scale here.

export type TrendSeries = { title: string; max: number; points: { at: string; total: number; band?: string }[] };

const day = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(iso));

export function TrendChart({ series, color = "var(--primary)" }: { series: TrendSeries; color?: string }) {
  const { points, max } = series;
  const W = 320, H = 132, padL = 26, padR = 14, padT = 18, padB = 24;
  const x = (i: number) => (points.length === 1 ? (padL + W - padR) / 2 : padL + (i * (W - padL - padR)) / (points.length - 1));
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join(" ");
  const first = points[0]?.total;
  const last = points.at(-1)?.total;
  const change = points.length > 1 && first !== undefined && last !== undefined ? last - first : null;

  return (
    <figure className="flex flex-col gap-1.5">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="font-semibold">{series.title}</span>
        <span className="text-small text-muted">
          {change === null ? "One check-in so far" : change < 0 ? `Down ${-change} since the first` : change > 0 ? `Up ${change} since the first` : "No change since the first"}
          {" · lower is better"}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-hidden="true" className="overflow-visible">
        {[0, max / 2, max].map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="var(--line-warm)" strokeWidth="1" />
            <text x={padL - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill="var(--muted)">
              {Math.round(v)}
            </text>
          </g>
        ))}
        {points.length > 1 && <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
        {points.map((p, i) => (
          <g key={p.at + i}>
            <circle cx={x(i)} cy={y(p.total)} r="4.5" fill={color} stroke="var(--surface)" strokeWidth="2" />
            <text x={x(i)} y={y(p.total) - 9} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--ink)">
              {p.total}
            </text>
            {(points.length <= 5 || i === 0 || i === points.length - 1) && (
              <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--muted)">
                {day(p.at)}
              </text>
            )}
          </g>
        ))}
      </svg>
      <table className="sr-only">
        <caption>{series.title} over time (lower is better)</caption>
        <tbody>
          {points.map((p, i) => (
            <tr key={p.at + i}>
              <th scope="row">{day(p.at)}</th>
              <td>
                {p.total} out of {max}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

const TITLES: Record<string, { title: string; max: number }> = {
  PHQ9: { title: "Mood (PHQ-9)", max: 27 },
  GAD7: { title: "Worry (GAD-7)", max: 21 },
  PHQ2: { title: "Mood screen (PHQ-2)", max: 6 },
  GAD2: { title: "Worry screen (GAD-2)", max: 6 },
};

/**
 * Picks what to chart: the full questionnaires when there are two or more of
 * them, otherwise the two-item screens (which every check-in has).
 */
export function seriesFrom(points: { at: string; instrument: string; total: number; band: string }[]): TrendSeries[] {
  const by = (inst: string) => points.filter((p) => p.instrument === inst);
  const pick = by("PHQ9").length >= 2 || by("GAD7").length >= 2 ? ["PHQ9", "GAD7"] : ["PHQ2", "GAD2"];
  return pick
    .map((inst) => ({ ...TITLES[inst], points: by(inst).map(({ at, total, band }) => ({ at, total, band })) }))
    .filter((s) => s.points.length > 0);
}
