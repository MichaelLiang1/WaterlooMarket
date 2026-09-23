import type { Metadata } from "next";
import Link from "next/link";
import { requestPasswordReset } from "@/app/actions/auth";
import { AuthCard } from "@/components/auth-card";
import { ActionForm, Field, SubmitButton } from "@/components/forms";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Reset your password" subtitle="We'll email you a link to choose a new one.">
      <ActionForm action={requestPasswordReset} className="space-y-4">
        <Field label="School email" name="email">
          <input id="email" name="email" type="email" required autoComplete="email" className="input" />
        </Field>
        <SubmitButton className="btn-primary w-full" pendingText="Sending…">
          Send reset link
        </SubmitButton>
      </ActionForm>
      <p className="mt-4 text-center text-sm">
        <Link href="/login" className="link">
          Back to log in
        </Link>
      </p>
    </AuthCard>
  );
}
