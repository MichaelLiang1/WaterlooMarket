import type { Metadata } from "next";
import Link from "next/link";
import { resetPassword } from "@/app/actions/auth";
import { AuthCard } from "@/components/auth-card";
import { ActionForm, Field, SubmitButton } from "@/components/forms";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage(props: PageProps<"/reset-password">) {
  const { token } = await props.searchParams;
  if (typeof token !== "string" || !token) {
    return (
      <AuthCard title="Link missing">
        <Link href="/forgot-password" className="link">
          Request a new reset link
        </Link>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Choose a new password">
      <ActionForm action={resetPassword} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <Field label="New password" name="password" hint="At least 8 characters.">
          <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
        </Field>
        <Field label="Confirm password" name="confirm">
          <input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" className="input" />
        </Field>
        <SubmitButton className="btn-primary w-full" pendingText="Saving…">
          Set password
        </SubmitButton>
      </ActionForm>
    </AuthCard>
  );
}
