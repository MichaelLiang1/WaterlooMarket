import type { Metadata } from "next";
import Link from "next/link";
import { ContactEmail, LegalPage, List, Section } from "@/components/legal";

export const metadata: Metadata = { title: "Terms of Use" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      intro={
        <p>
          These terms apply when you use Waterloo Market. By creating an account, you agree to them
          and to our <Link href="/privacy" className="link">Privacy Policy</Link>. Waterloo Market is
          an independent student project. It is not operated, endorsed, or supported by the
          University of Waterloo.
        </p>
      }
    >
      <Section title="Who can use it">
        <List>
          <li>You need a valid University of Waterloo email address to sign up.</li>
          <li>Use your real name, keep one account per person, and don&apos;t share your login.</li>
          <li>You&apos;re responsible for what happens under your account.</li>
        </List>
      </Section>

      <Section title="We connect people; we're not part of the deal">
        <p>
          Waterloo Market is a place to find each other. We don&apos;t own, inspect, store, or
          deliver items, and we don&apos;t handle payments or deposits. Every sale, rental, storage
          arrangement, and sublet is an agreement between the users involved, who are responsible
          for:
        </p>
        <List>
          <li>describing items honestly, including condition and any defects;</li>
          <li>agreeing on price, pickup, deposits, and return dates, and keeping to them;</li>
          <li>returning rented items and stored belongings in the condition received; and</li>
          <li>
            for sublets, having the right to sublet: check your lease or housing agreement first.
            University residence rooms generally can&apos;t be sublet.
          </li>
        </List>
        <p>
          Deposit amounts shown on listings are for information only. Keep a written record, such as
          a message in the app, of any deposit you pay or receive.
        </p>
      </Section>

      <Section title="What you can't post">
        <List>
          <li>Weapons, ammunition, or anything illegal to sell or own in Ontario</li>
          <li>Alcohol, cannabis, tobacco or vaping products, drugs, or prescription medication</li>
          <li>Stolen, counterfeit, or recalled goods</li>
          <li>
            Academic dishonesty: completed assignments, exam answers, or &quot;do my homework&quot;
            services
          </li>
          <li>Live animals</li>
          <li>Hazardous materials</li>
          <li>Adult content, or anything hateful, harassing, or discriminatory</li>
          <li>Someone else&apos;s personal information, or photos of people without their consent</li>
          <li>Spam, duplicate listings, bait-and-switch pricing, or ads for off-campus businesses</li>
        </List>
      </Section>

      <Section title="How to behave">
        <List>
          <li>Be respectful in messages and reviews. No harassment, threats, or discrimination.</li>
          <li>Leave honest reviews only for transactions you took part in.</li>
          <li>Don&apos;t scrape the site, get around rate limits, or interfere with how it works.</li>
          <li>
            Meet in public places and inspect items before paying. See our{" "}
            <Link href="/safety" className="link">safety tips</Link>.
          </li>
        </List>
      </Section>

      <Section title="Your content">
        <p>
          You keep ownership of what you post. You give us permission to store it, display it on
          the site, and include it in notifications so the marketplace can work. That permission
          ends when you delete the content, except for copies other users have already received,
          such as messages. Only post photos and text you have the right to share.
        </p>
      </Section>

      <Section title="Moderation">
        <p>
          We may remove listings, limit or suspend accounts, or ban users who break these terms or
          put others at risk, with or without notice. If you see something that breaks the rules,
          use the ⚑ Report link. If you believe we made a mistake, email <ContactEmail />.
        </p>
      </Section>

      <Section title="No guarantees">
        <p>
          The site is provided &quot;as is&quot;. It may have bugs or downtime, and we can&apos;t
          promise that listings, users, or items are accurate, safe, or as described. To the extent
          the law allows, we&apos;re not liable for losses arising from transactions between users,
          from items bought, rented, or stored through the site, or from your use of the site.
        </p>
      </Section>

      <Section title="Other">
        <List>
          <li>
            We may update these terms. If we make significant changes, we&apos;ll update the date
            above and notify users in the app. Continuing to use the site means you accept the
            updated terms.
          </li>
          <li>You can stop using the site at any time and ask us to delete your account.</li>
          <li>These terms are governed by the laws of Ontario and the federal laws of Canada that apply there.</li>
          <li>
            Questions: <ContactEmail />
          </li>
        </List>
      </Section>
    </LegalPage>
  );
}
