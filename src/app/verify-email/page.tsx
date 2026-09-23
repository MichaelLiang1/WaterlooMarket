import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { logout, resendVerification } from "@/app/actions/auth";
import { AuthCard } from "@/components/auth-card";
import { ActionForm, SubmitButton } from "@/components/forms";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Confirm your email" };

export default async function VerifyEmailPage(props: PageProps<"/verify-email">) {
  const user = await requireUser();
  if (user.emailVerifiedAt) redirect("/");
  const { invalid } = await props.searchParams;
  return (
    <AuthCard
      title="Check your inbox"
      subtitle={
        <>
          We sent a confirmation link to <strong>{user.email}</strong>. Click it to finish signing up.
        </>
      }
    >
      {invalid && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          That link is invalid or expired. Send yourself a new one below.
        </p>
      )}
      <ActionForm action={resendVerification}>
        <SubmitButton className="btn-primary w-full" pendingText="Sending…">
          Resend confirmation email
        </SubmitButton>
      </ActionForm>
      <p className="mt-4 text-xs text-stone-500">
        Can&apos;t find it? Check your junk folder — school filters sometimes catch new senders.
      </p>
      <form action={logout} className="mt-4">
        <button className="text-sm text-stone-600 hover:underline">Wrong email? Log out</button>
      </form>
    </AuthCard>
  );
}
