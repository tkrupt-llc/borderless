import { Suspense } from "react";
import { PatientHeader } from "@/components/patient-header";
import { ChatView } from "./chat-view";

// The AI conversation at the start of the full check-in. The view reads the
// path from the URL on the client, so it streams in behind Suspense.
export default function ChatPage() {
  return (
    <>
      <PatientHeader backHref="/start" />
      <Suspense>
        <ChatView />
      </Suspense>
    </>
  );
}
