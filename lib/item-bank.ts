import { ItemBankFile, type Instrument, type Item } from "@/lib/contracts/item-bank";
import phq2 from "@/content/item-bank/phq2.json";
import phq9 from "@/content/item-bank/phq9.json";
import gad2 from "@/content/item-bank/gad2.json";
import gad7 from "@/content/item-bank/gad7.json";
import qcSuicide from "@/content/item-bank/qc-suicide.json";
import asq from "@/content/item-bank/asq.json";
import cssrs from "@/content/item-bank/cssrs-screener.json";
import redFlag from "@/content/item-bank/red-flag.json";
import bpdAdhdExtra from "@/content/item-bank/bpd-adhd-extra.json";

// Every file is validated against the contract when this module loads,
// so a broken content file stops the app instead of showing a wrong question.
const files = [phq2, phq9, gad2, gad7, qcSuicide, asq, cssrs, redFlag, bpdAdhdExtra].map((raw) =>
  ItemBankFile.parse(raw),
);

const byInstrument = new Map<Instrument, ItemBankFile>(files.map((f) => [f.instrument, f]));
const byItemId = new Map<string, Item>(files.flatMap((f) => f.items.map((i) => [i.id, i] as const)));

export function bankFile(instrument: Instrument): ItemBankFile {
  const file = byInstrument.get(instrument);
  if (!file) throw new Error(`Item bank has no ${instrument} file`);
  return file;
}

export function bankItem(itemId: string): Item | undefined {
  return byItemId.get(itemId);
}

/** True only if the value is one of the item's own answer options. */
export function isValidAnswer(itemId: string, value: number): boolean {
  return byItemId.get(itemId)?.options.some((o) => o.value === value) ?? false;
}

export function allBankFiles(): readonly ItemBankFile[] {
  return files;
}
