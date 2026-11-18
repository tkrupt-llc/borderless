import { Backdrop } from "@/components/backdrop";
import Link from "next/link";
import { PatientHeader } from "@/components/patient-header";
import { ChevronRight } from "@/components/icons";
import { Receipt } from "./receipt";
import { HowDidThatFeel, PickedCard } from "./after-check-in";
import { ReturnCodeNote } from "@/components/return-code-note";

// The id is not read yet: until the database is wired, the timeline uses the
// submit time saved in this tab. TODO(DB): load the receipt by id.
export default function ReceiptPage() {
  return (
    <>
      <PatientHeader />
      <Backdrop side="left" />
      <Receipt />

      <div className="flex flex-col gap-2.5 px-5 pt-2">
        <PickedCard />
        <Link
          href="/guides"
          className="flex min-h-11 items-center justify-between rounded-2xl bg-surface px-4 py-3.5 text-ink no-underline hover:text-ink"
        >
          <span className="flex flex-col">
            <strong className="text-base font-semibold">Self-help guides</strong>
            <span className="text-small text-muted">Sleep, worry and breathing</span>
          </span>
          <ChevronRight />
        </Link>
        <Link
          href="/support-options"
          className="flex min-h-11 items-center justify-between rounded-2xl bg-surface px-4 py-3.5 text-ink no-underline hover:text-ink"
        >
          <span className="flex flex-col">
            <strong className="text-base font-semibold">Your support options</strong>
            <span className="text-small text-muted">From self-help to specialist care in Abu Dhabi</span>
          </span>
          <ChevronRight />
        </Link>
        <HowDidThatFeel />
        <ReturnCodeNote />
        <p className="text-small text-muted">If things get worse before then, tap &ldquo;I need help now&rdquo;.</p>
        <Link href="/my-data" className="inline-flex min-h-11 items-center self-start text-caption text-primary-dark underline underline-offset-2">
          See or delete your data
        </Link>
      </div>
    </>
  );
}
