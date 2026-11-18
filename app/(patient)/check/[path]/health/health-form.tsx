"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { savePhysicalHealth } from "../../actions";
import { CONDITIONS, type ConditionId } from "@/lib/physical-health";
import { purposeById } from "@/lib/consent";

const card =
  "flex min-h-11 cursor-pointer items-start gap-3.5 rounded-2xl border-[1.5px] border-line bg-surface px-4 py-3.5 has-checked:border-primary";
const box = "mt-1 size-5 shrink-0 cursor-pointer accent-primary";

export function HealthForm() {
  const { path } = useParams<{ path: string }>();
  const router = useRouter();
  const [share, setShare] = useState(false);
  const [gp, setGp] = useState(false);
  const [conditions, setConditions] = useState<ConditionId[]>([]);
  const [other, setOther] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const next = `/check/${path}/contact`;
  const sharePurpose = purposeById("physical_health")!;
  const gpPurpose = purposeById("gp_sharing")!;

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await savePhysicalHealth({
        physicalHealth: share,
        gpSharing: gp,
        conditions: share ? conditions : [],
        other: share ? other : "",
      }).catch(() => ({ ok: false as const, reason: "error" as const }));
      if (r.ok) router.push(next);
      else setError("That didn't save. Please try again, or tap Skip.");
    });
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4 px-5 pt-5">
      <label className={card}>
        <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className={box} />
        <span className="flex flex-col">
          <strong className="font-semibold">{sharePurpose.title}</strong>
          <span className="text-caption text-muted">{sharePurpose.explanation}</span>
        </span>
      </label>

      {share && (
        <fieldset className="anim-pop flex flex-col gap-1 rounded-2xl bg-surface px-4 py-3.5">
          <legend className="mb-1 font-semibold">Do any of these apply to you?</legend>
          {CONDITIONS.map((c) => (
            <label key={c.id} className="flex min-h-11 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={conditions.includes(c.id)}
                onChange={(e) => setConditions((cur) => (e.target.checked ? [...cur, c.id] : cur.filter((x) => x !== c.id)))}
                className="size-5 shrink-0 cursor-pointer accent-primary"
              />
              {c.label}
            </label>
          ))}
          <label className="mt-1 flex flex-col gap-1">
            <span className="text-caption text-text-2">Anything else (optional)</span>
            <input
              value={other}
              maxLength={200}
              onChange={(e) => setOther(e.target.value)}
              className="min-h-11 rounded-xl border-[1.5px] border-line bg-surface px-3"
            />
          </label>
        </fieldset>
      )}

      <label className={card}>
        <input type="checkbox" checked={gp} onChange={(e) => setGp(e.target.checked)} className={box} />
        <span className="flex flex-col">
          <strong className="font-semibold">{gpPurpose.title}</strong>
          <span className="text-caption text-muted">{gpPurpose.explanation}</span>
        </span>
      </label>

      <p className="text-caption text-text-2">Never shared with your employer or university. You can change this later.</p>

      <div className="flex flex-col gap-1">
        <button
          type="submit"
          disabled={pending}
          className="tap flex min-h-[52px] cursor-pointer items-center justify-center rounded-full bg-primary font-semibold text-white disabled:cursor-wait disabled:opacity-80"
        >
          {pending ? "Saving…" : "Save and continue"}
        </button>
        <Link href={next} className="flex min-h-11 items-center justify-center text-caption">
          Skip
        </Link>
        <p role="status" className="min-h-6 text-caption text-danger">
          {error}
        </p>
      </div>
    </form>
  );
}
