"use client";

import { createAlert } from "@/app/actions/social";
import { ActionForm, SubmitButton } from "./forms";

/** Turns the current feed filters into a saved alert. */
export function SaveAlertButton({ filters }: { filters: Record<string, string | undefined> }) {
  return (
    <ActionForm action={createAlert} className="inline">
      {Object.entries(filters).map(([k, v]) =>
        v ? <input key={k} type="hidden" name={k} value={v} /> : null,
      )}
      <SubmitButton className="btn-secondary btn-sm" pendingText="Saving…">
        🔔 Alert me about new matches
      </SubmitButton>
    </ActionForm>
  );
}
