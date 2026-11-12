import type { Instrument, Item } from "@/lib/contracts/item-bank";
import { bankFile } from "@/lib/item-bank";

/** Which instruments each path asks, in order. */
export const PATHS = {
  quick: ["PHQ2", "GAD2", "QC_SUICIDE"],
  full: ["PHQ9", "GAD7"],
} as const satisfies Record<string, Instrument[]>;
export type PathId = keyof typeof PATHS;

export function isPathId(value: string): value is PathId {
  return value in PATHS;
}

/** Section names shown in the progress label, e.g. "Mood · 3 of 9". */
const SECTION: Partial<Record<Instrument, string>> = {
  PHQ2: "Mood",
  PHQ9: "Mood",
  GAD2: "Worry",
  GAD7: "Worry",
  QC_SUICIDE: "Safety",
};

export type Step = {
  item: Item;
  stem?: string;
  section: string;
  indexInSection: number; // 1-based
  sectionSize: number;
};

export function stepsFor(path: PathId): Step[] {
  return PATHS[path].flatMap((instrument) => {
    const file = bankFile(instrument);
    return file.items.map((item, i) => ({
      item,
      stem: file.stem?.en,
      section: SECTION[instrument] ?? instrument,
      indexInSection: i + 1,
      sectionSize: file.items.length,
    }));
  });
}

/** Every item id a path can ask: the server only accepts answers to these. */
export function itemIdsFor(path: PathId): Set<string> {
  return new Set(stepsFor(path).map((s) => s.item.id));
}
