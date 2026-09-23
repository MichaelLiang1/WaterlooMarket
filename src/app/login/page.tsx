import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { login } from "@/app/actions/auth";
import { AuthCard } from "@/components/auth-card";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage(props: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/");
  const { next } = await props.searchParams;
  return (
    <AuthCard title="Log in">
      <ActionForm action={login} className="space-y-4">
        <input type="hidden" name="next" value={typeof next === "string" ? next : "/"} />
        <Field label="School email" name="email">
          <input id="email" name="email" type="email" required autoComplete="email" className="input" />
        </Field>
        <Field label="Password" name="password">
          <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
        </Field>
        <SubmitButton className="btn-primary w-full" pendingText="Logging in…">
          Log in
        </SubmitButton>
      </ActionForm>
      <div className="mt-4 flex justify-between text-sm">
        <Link href="/forgot-password" className="link">
          Forgot password?
        </Link>
        <Link href="/signup" className="link">
          Create an account
        </Link>
      </div>
    </AuthCard>
  );
}
