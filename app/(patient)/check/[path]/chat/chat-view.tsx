"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { loadChat, sendChat, type ChatMessageView, type SendResult } from "./actions";
import { CHAT_INTRO } from "@/lib/ai/prompt";
import { MAX_MESSAGE_LENGTH } from "@/lib/chat/turn";

// Research: AI labelled in the header; 1-3 quick replies plus an optional text
// box; short replies; no typing animation that could delay a crisis reply.

export function ChatView() {
  const { path } = useParams<{ path: string }>();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [persisted, setPersisted] = useState(true);
  const [draft, setDraft] = useState("");
  const [handedOff, setHandedOff] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  const questionsHref = `/check/${path}/1`;

  // Only the full check-in has a conversation; load any earlier messages (resume).
  useEffect(() => {
    if (path !== "full") {
      router.replace(questionsHref);
      return;
    }
    let cancelled = false;
    loadChat()
      .then((r) => {
        if (cancelled) return;
        if (!r.ok) {
          if (r.reason === "no_session") router.replace(`/check/${path}/consent`);
          else setFailed(true);
          return;
        }
        if (r.takenOver) {
          router.replace("/help-now");
          return;
        }
        setMessages(r.messages);
        setPersisted(r.persisted);
      })
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [path, router, questionsHref]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pending]);

  function send(text: string) {
    const clean = text.trim();
    if (!clean || pending || handedOff) return;
    setFailed(false);
    // Shown at once; only one message is ever in flight, so a fixed id is safe.
    const before = messages;
    setMessages([...before, { id: "pending", role: "patient", text: clean, quickReplies: [] }]);
    setDraft("");
    startTransition(async () => {
      let result: SendResult;
      try {
        result = await sendChat({
          text: clean,
          // Without a database the browser holds the conversation.
          transcript: persisted ? undefined : before.map(({ id, role, text }) => ({ id, role, text })),
        });
      } catch {
        result = { ok: false, reason: "error" };
      }
      if (!result.ok) {
        if (result.reason === "no_session") {
          router.replace(`/check/${path}/consent`);
          return;
        }
        setMessages(before);
        setDraft(clean);
        setFailed(true);
        return;
      }
      // A red flag: straight to the emergency numbers.
      if (result.outcome === "safety_positive" || result.outcome === "taken_over") {
        router.replace("/help-now");
        return;
      }
      setMessages([
        ...before,
        { id: result.patientId, role: "patient", text: clean, quickReplies: [] },
        ...result.messages,
      ]);
      if (result.outcome === "handoff") setHandedOff(true);
    });
  }

  const last = messages.at(-1);
  const quickReplies = !pending && !handedOff && last && last.role !== "patient" ? last.quickReplies : [];
  const hasPatientMessage = messages.some((m) => m.role === "patient");

  return (
    <div className="flex flex-1 flex-col px-5 pt-3">
      {/* AI label, always visible above the conversation. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-2xl bg-ai-soft px-4 py-2.5">
        <span className="flex items-center gap-2.5">
          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-ai">
            <svg width="18" height="18" viewBox="0 0 40 40">
              <path d="M32.3 9.7 A16 16 0 1 0 32.3 30.3" fill="none" stroke="var(--brand)" strokeWidth="5" strokeLinecap="round" />
              <circle cx="27" cy="20" r="3.6" fill="var(--clay)" />
            </svg>
          </span>
          <span className="flex flex-col leading-tight">
            <strong className="text-caption font-semibold">AI assistant, not a therapist</strong>
            <span className="text-[0.8125rem] text-ai-ink">A clinician reads everything</span>
          </span>
        </span>
        <details className="text-caption">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-primary-dark underline">
            Why am I asked this?
          </summary>
          <p className="pb-2 text-text-2">
            Your own words help a clinician understand what has been happening, before they read your answers to
            the short questions. The assistant never diagnoses you, and a clinician reads everything.
          </p>
        </details>
      </div>

      <ol aria-live="polite" aria-label="Conversation" className="flex flex-1 flex-col gap-3 py-4">
        <Bubble role="assistant" text={CHAT_INTRO} />
        {messages.map((m) => (
          <Bubble key={m.id} role={m.role} text={m.text} />
        ))}
        {pending && (
          <li role="status" className="anim-pop flex gap-1.5 self-start rounded-2xl rounded-bl-md bg-ai-soft px-4 py-3.5">
            <span className="sr-only">The assistant is writing a reply</span>
            <span className="typing-dot" aria-hidden="true" />
            <span className="typing-dot" aria-hidden="true" />
            <span className="typing-dot" aria-hidden="true" />
          </li>
        )}
      </ol>
      <div ref={endRef} />

      {failed && (
        <p role="alert" className="pb-2 text-caption text-text-2">
          {loaded ? "That didn't send. Please try again." : "The conversation couldn't load. Please try again."}
        </p>
      )}

      {quickReplies.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-3" aria-label="Suggested answers">
          {quickReplies.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => send(q)}
              className="tap anim-pop min-h-11 cursor-pointer rounded-full border-[1.5px] border-line bg-surface px-4 text-caption font-medium text-ink hover:border-primary"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {!handedOff && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
          className="flex items-end gap-2 pb-3"
        >
          <label className="flex flex-1 flex-col gap-1">
            <span className="sr-only">Your message</span>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(draft);
                }
              }}
              rows={2}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder={quickReplies.length ? "Or type your own answer" : "Type your answer"}
              className="min-h-12 w-full resize-none rounded-2xl border-[1.5px] border-line bg-surface px-4 py-2.5 text-body focus:border-primary"
            />
          </label>
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            className="min-h-12 cursor-pointer rounded-full bg-primary px-5 font-medium text-white disabled:cursor-default disabled:opacity-60"
          >
            Send
          </button>
        </form>
      )}

      {(hasPatientMessage || handedOff) && (
        <button
          type="button"
          onClick={() => router.push(questionsHref)}
          className={`mb-2 flex min-h-12 cursor-pointer items-center justify-center rounded-full px-6 font-medium ${
            handedOff ? "bg-primary text-white" : "border-[1.5px] border-ink text-ink"
          }`}
        >
          Continue to the questions
        </button>
      )}
    </div>
  );
}

function Bubble({ role, text }: { role: ChatMessageView["role"]; text: string }) {
  if (role === "patient") {
    return (
      <li className="anim-pop max-w-[85%] self-end rounded-2xl rounded-br-md bg-primary px-4 py-2.5 font-medium text-white">
        <span className="sr-only">You: </span>
        {text}
      </li>
    );
  }
  return (
    <li
      className={`anim-pop max-w-[85%] self-start rounded-2xl rounded-bl-md px-4 py-2.5 ${
        role === "system" ? "bg-sky text-ink" : "bg-ai-soft text-ink"
      }`}
    >
      <span className="sr-only">{role === "system" ? "Borderless: " : "AI assistant: "}</span>
      {text}
    </li>
  );
}
