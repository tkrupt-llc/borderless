/**
 * Two soft shapes behind a calm patient page (design canvas): mist blue and
 * lavender, drifting for two slow cycles, then still. Decorative only; never on
 * the crisis page or a question page. Off with "reduce motion".
 */
export function Backdrop({ side = "left" }: { side?: "left" | "right" }) {
  const blue = side === "left" ? "-top-[220px] -left-[160px] size-[520px]" : "-top-[230px] -right-[170px] size-[540px]";
  const lavender = side === "left" ? "-bottom-[180px] -right-[140px] size-[430px]" : "-bottom-[160px] -left-[130px] size-[390px]";
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className={`drift absolute rounded-full bg-sky ${blue}`} />
      <div className={`drift2 absolute rounded-full bg-cat-distress ${lavender}`} />
    </div>
  );
}
