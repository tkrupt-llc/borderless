"use client";

import Link from "next/link";
import { useState } from "react";

/** Shown only if the person chooses it (approved: written for people of any faith or none). */
export function FaithGuide({ title, text, ending }: { title: string; text: string; ending: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap flex min-h-12 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-line bg-surface px-5 text-caption font-medium text-ink"
      >
        Show the guide on {title.toLowerCase()}
      </button>
    );
  }
  return (
    <section aria-labelledby="g-faith" className="anim-pop flex flex-col gap-2 rounded-2xl bg-surface px-5 py-4">
      <h2 id="g-faith" className="font-serif text-[1.375rem] leading-tight font-normal">
        {title}
      </h2>
      <p className="text-ink">{text}</p>
      <p className="text-caption text-text-2">
        {ending.split("talk to a person")[0]}
        <Link href="/talk">talk to a person</Link>
        {ending.split("talk to a person")[1]}
      </p>
    </section>
  );
}
