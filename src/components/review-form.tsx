"use client";

import { submitReview } from "@/app/actions/social";
import { ActionForm, SubmitButton } from "./forms";

export function ReviewForm({ requestId, name }: { requestId: string; name: string }) {
  return (
    <details className="mt-2 text-sm">
      <summary className="link cursor-pointer">★ Review {name}</summary>
      <ActionForm action={submitReview} className="mt-2 space-y-2">
        <input type="hidden" name="requestId" value={requestId} />
        <div className="flex flex-row-reverse justify-end gap-1">
          {/* Reversed so the CSS sibling selector can light up lower stars. */}
          {[5, 4, 3, 2, 1].map((n) => (
            <label key={n} className="cursor-pointer text-2xl text-stone-300 has-[:checked]:text-gold-500 [label:has(:checked)~&]:text-gold-500">
              <input type="radio" name="rating" value={n} required className="sr-only" />
              <span aria-label={`${n} star${n === 1 ? "" : "s"}`}>★</span>
            </label>
          ))}
        </div>
        <textarea name="comment" rows={2} maxLength={1000} placeholder="How did it go? (optional)" className="input" />
        <SubmitButton className="btn-primary btn-sm" pendingText="Posting…">
          Post review
        </SubmitButton>
      </ActionForm>
    </details>
  );
}
