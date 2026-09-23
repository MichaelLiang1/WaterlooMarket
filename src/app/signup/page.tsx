import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signup } from "@/app/actions/auth";
import { AuthCard } from "@/components/auth-card";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { allowedEmailDomains, getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/");
  const domain = allowedEmailDomains()[0];
  return (
    <AuthCard title="Join Waterloo Market" subtitle={`For UWaterloo students only — sign up with your @${domain} email.`}>
      <ActionForm action={signup} className="space-y-4">
        <Field label="Name" name="name">
          <input id="name" name="name" required maxLength={60} autoComplete="name" className="input" />
        </Field>
        <Field label="School email" name="email">
          <input id="email" name="email" type="email" required autoComplete="email" placeholder={`you@${domain}`} className="input" />
        </Field>
        <Field label="Password" name="password" hint="At least 8 characters.">
          <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
        </Field>
        <div className="grid grid-cols-[2fr_1fr] gap-3">
          <Field label="Program (optional)" name="program">
            <input id="program" name="program" maxLength={60} placeholder="Computer Science" className="input" />
          </Field>
          <Field label="Year" name="year">
            <select id="year" name="year" defaultValue="" className="input">
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <SubmitButton className="btn-primary w-full" pendingText="Creating account…">
          Create account
        </SubmitButton>
        <p className="text-center text-xs text-stone-500">
          By creating an account, you agree to the{" "}
          <Link href="/terms" className="link">
            Terms of Use
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="link">
            Privacy Policy
          </Link>
          .
        </p>
      </ActionForm>
      <p className="mt-4 text-center text-sm text-stone-600">
        Already have an account?{" "}
        <Link href="/login" className="link">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
