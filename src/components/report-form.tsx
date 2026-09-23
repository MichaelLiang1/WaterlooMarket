"use client";

import { submitReport } from "@/app/actions/social";
import { REPORT_REASONS } from "@/lib/constants";
import { ActionForm, SubmitButton } from "./forms";

export function ReportForm({ listingId, userId, label = "Report" }: { listingId?: string; userId?: string; label?: string }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-stone-500 hover:text-red-700">⚑ {label}</summary>
      <ActionForm action={submitReport} className="mt-2 space-y-2" resetOnSuccess>
        {listingId && <input type="hidden" name="listingId" value={listingId} />}
        {userId && <input type="hidden" name="userId" value={userId} />}
        <select name="reason" required defaultValue="" className="input">
          <option value="" disabled>
            Why are you reporting this?
          </option>
          {REPORT_REASONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <textarea name="details" rows={2} maxLength={2000} placeholder="Anything moderators should know (optional)" className="input" />
        <SubmitButton className="btn-danger btn-sm" pendingText="Sending…">
          Send report
        </SubmitButton>
      </ActionForm>
    </details>
  );
}
