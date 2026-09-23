"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { sendMessage } from "@/app/actions/messages";
import { ActionForm, SubmitButton } from "./forms";

/** Composer plus a light poll so new replies show up without reloading. */
export function MessageComposer({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 8000);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <>
      <div ref={endRef} />
      <ActionForm action={sendMessage} resetOnSuccess showSuccess={false} className="sticky bottom-16 flex gap-2 border-t border-stone-200 bg-stone-50 pt-3 md:bottom-0">
        <input type="hidden" name="conversationId" value={conversationId} />
        <textarea
          name="body"
          required
          rows={1}
          maxLength={2000}
          placeholder="Write a message…"
          className="input flex-1 resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <SubmitButton className="btn-primary">Send</SubmitButton>
      </ActionForm>
    </>
  );
}
