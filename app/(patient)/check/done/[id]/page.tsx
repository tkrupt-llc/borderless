import Link from "next/link";
import { PatientHeader } from "@/components/patient-header";
import { ChevronRight } from "@/components/icons";
import { Receipt } from "./receipt";

// The id is not read yet: until the database is wired, the timeline uses the
// submit time saved in this tab. TODO(DB): load the receipt by id.
export default function ReceiptPage() {
  return (
    <>
      <PatientHeader />
      <Receipt />

      <div className="flex flex-col gap-2.5 px-5 pt-2">
        <Link
          href="/coping"
          className="flex min-h-11 items-center justify-between rounded-2xl bg-surface px-4 py-3.5 text-ink no-underline hover:text-ink"
        >
          <span className="flex flex-col">
            <strong className="text-base font-semibold">While you wait</strong>
            <span className="text-small text-muted">Try a coping card</span>
          </span>
          <ChevronRight />
        </Link>
        <p className="text-small text-muted">If things get worse before then, tap &ldquo;I need help now&rdquo;.</p>
      </div>
    </>
  );
}
