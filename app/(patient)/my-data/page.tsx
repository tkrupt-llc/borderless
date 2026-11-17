import { PatientHeader } from "@/components/patient-header";
import { DeleteData } from "./delete-data";

// "You can delete your data at any time" (the data promise on the start page).
export default function MyDataPage() {
  return (
    <>
      <PatientHeader />
      <div className="flex flex-col gap-5 px-5 pt-5">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-serif text-[1.875rem] leading-tight font-normal">
            Your <em className="text-primary">data</em>
          </h1>
          <p className="text-text-2">You can see what we keep, and delete it whenever you like.</p>
        </div>

        <section aria-labelledby="kept-h" className="rounded-2xl bg-sky px-4 py-3.5">
          <h2 id="kept-h" className="font-semibold">
            What we keep from a check-in
          </h2>
          <ul className="mt-1.5 flex list-disc flex-col gap-1 ps-5 text-caption text-text-2">
            <li>Your answers and scores</li>
            <li>What you wrote in the chat, if you used it</li>
            <li>Your phone number and call preferences, only if you shared them</li>
            <li>The choices you made about sharing</li>
            <li>Notes your care team adds</li>
          </ul>
          <p className="mt-2 text-caption text-text-2">No name or account. Only your care team can see it.</p>
        </section>

        <DeleteData />
      </div>
    </>
  );
}
