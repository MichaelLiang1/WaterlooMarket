import type { Metadata } from "next";
import { changePassword, updateProfile } from "@/app/actions/auth";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { manualApproval, requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Account settings" };

export default async function AccountPage() {
  const user = await requireUser("/account");
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">Account settings</h1>

      <section className="card p-5">
        <h2 className="mb-4 font-semibold">Profile</h2>
        <ActionForm action={updateProfile} className="space-y-4">
          <Field label="Name" name="name">
            <input id="name" name="name" required maxLength={60} defaultValue={user.name} className="input" />
          </Field>
          <div className="grid grid-cols-[2fr_1fr] gap-3">
            <Field label="Program" name="program">
              <input id="program" name="program" maxLength={60} defaultValue={user.program ?? ""} className="input" />
            </Field>
            <Field label="Year" name="year">
              <select id="year" name="year" defaultValue={user.year ?? ""} className="input">
                <option value="">—</option>
                {[1, 2, 3, 4, 5].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div>
            <p className="label">Email</p>
            <p className="text-sm text-stone-700">
              {user.email}{" "}
              {user.emailVerifiedAt ? "✓ verified" : manualApproval() ? "(waiting for approval)" : "(not verified)"}
            </p>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="emailNotifications" defaultChecked={user.emailNotifications} className="mt-0.5" />
            <span>
              Email me about new messages, requests, and alert matches
              <span className="block text-xs text-stone-500">You&apos;ll always see them in-app.</span>
            </span>
          </label>
          <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
        </ActionForm>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 font-semibold">Change password</h2>
        <ActionForm action={changePassword} className="space-y-4" resetOnSuccess>
          <Field label="Current password" name="current">
            <input id="current" name="current" type="password" required autoComplete="current-password" className="input" />
          </Field>
          <Field label="New password" name="password" hint="At least 8 characters.">
            <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
          </Field>
          <SubmitButton pendingText="Saving…">Change password</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
