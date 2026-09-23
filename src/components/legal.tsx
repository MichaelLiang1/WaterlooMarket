import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL_LAST_UPDATED, contactEmail } from "@/lib/site";

export function LegalPage({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl space-y-6 pb-8 text-sm leading-relaxed text-stone-800">
      <header>
        <h1 className="text-2xl font-bold text-stone-900">{title}</h1>
        <p className="mt-1 text-xs text-stone-500">Last updated {LEGAL_LAST_UPDATED}</p>
        <div className="mt-3">{intro}</div>
      </header>
      {children}
      <footer className="border-t border-stone-200 pt-4 text-xs text-stone-500">
        See also: <Link href="/terms" className="link">Terms of Use</Link> ·{" "}
        <Link href="/privacy" className="link">Privacy Policy</Link> ·{" "}
        <Link href="/safety" className="link">Safety tips</Link>
      </footer>
    </article>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-stone-900">{title}</h2>
      {children}
    </section>
  );
}

export function List({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1 pl-5">{children}</ul>;
}

/** The contact address, or a loud placeholder so a missing config is obvious. */
export function ContactEmail() {
  const email = contactEmail();
  if (!email) {
    return <strong className="rounded bg-red-100 px-1 text-red-800">[set CONTACT_EMAIL]</strong>;
  }
  return (
    <a href={`mailto:${email}`} className="link">
      {email}
    </a>
  );
}
