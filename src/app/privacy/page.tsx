import type { Metadata } from "next";
import Link from "next/link";
import { ContactEmail, LegalPage, List, Section } from "@/components/legal";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={
        <p>
          Waterloo Market is an independent marketplace run by students. It is not operated by or
          affiliated with the University of Waterloo. This policy explains what we collect, who can
          see it, and how to have it deleted. We&apos;ve tried to keep it short and plain.
        </p>
      }
    >
      <Section title="What we collect">
        <List>
          <li>
            <strong>Account details:</strong> your name, school email address, and (if you add them)
            your program and year. Your password is stored only as a one-way hash; we can&apos;t see it.
          </li>
          <li>
            <strong>What you post:</strong> listings, photos, prices, pickup areas, dates, move-out
            bundles, wanted posts, and search alerts.
          </li>
          <li>
            <strong>Activity with other users:</strong> requests to buy or rent, the messages you
            send, reviews, and reports.
          </li>
          <li>
            <strong>Technical data:</strong> a login cookie (see below) and, when you sign up, log in,
            or reset your password, your IP address, used only to block abuse such as password guessing.
          </li>
        </List>
        <p>
          We remove location and camera metadata (EXIF), including GPS coordinates, from every
          photo you upload before storing it. We never ask for your home address; listings only show
          a general area you choose.
        </p>
      </Section>

      <Section title="Who can see what">
        <List>
          <li>
            <strong>Anyone, including people who aren&apos;t logged in:</strong> your listings and
            photos, and your public profile (name, program, year, when you joined, your active
            listings, and reviews others have left you).
          </li>
          <li>
            <strong>The other person in a transaction:</strong> your email address is shown only
            after a request between you is accepted, so you can arrange pickup.
          </li>
          <li>
            <strong>The person you&apos;re messaging:</strong> your messages in that conversation.
          </li>
          <li>
            <strong>Moderators:</strong> account details, listings, and reports, so they can handle
            abuse. We don&apos;t read private messages except to investigate a report or where
            required by law.
          </li>
        </List>
      </Section>

      <Section title="How we use it">
        <List>
          <li>To run the marketplace: show listings, deliver requests and messages, and prevent double-bookings.</li>
          <li>
            To email you verification and password-reset links, and (unless you turn them off in{" "}
            <Link href="/account" className="link">Account settings</Link>) notifications about
            messages, requests, alert matches, and expiring listings.
          </li>
          <li>To keep the site safe: rate limits, spam prevention, and acting on reports.</li>
        </List>
        <p>
          We don&apos;t sell your information, show ads, or use third-party analytics or tracking.
        </p>
      </Section>

      <Section title="Cookies">
        <p>
          We use one cookie, which keeps you logged in for up to 30 days. It&apos;s required for the
          site to work, and it isn&apos;t used for tracking. Logging out deletes it.
        </p>
      </Section>

      <Section title="Service providers">
        <p>
          We rely on a small number of providers to run the site: a hosting provider, a database
          provider, and an email delivery service. They store or process data only to provide their
          service to us. Some of them may store data outside Canada, in which case it&apos;s subject
          to the laws of that country.
        </p>
      </Section>

      <Section title="How long we keep it">
        <List>
          <li>Your account and what you&apos;ve posted: until you delete it or ask us to delete your account.</li>
          <li>Login sessions: up to 30 days, then deleted.</li>
          <li>IP addresses recorded for abuse prevention: deleted within about two days.</li>
          <li>
            If an account is banned, we may keep related records for as long as needed to prevent
            the person from returning or to deal with safety issues.
          </li>
        </List>
      </Section>

      <Section title="Your choices and rights">
        <List>
          <li>Edit your profile, turn email notifications off, and edit or delete your listings at any time.</li>
          <li>
            Ask us for a copy of your information, to correct it, or to delete your account by
            emailing <ContactEmail /> from your school email address. We&apos;ll respond within 30 days.
          </li>
          <li>
            Deleting your account removes your profile, listings, photos, messages, requests,
            reviews you wrote and received, and alerts. Reports that others made about you are kept,
            but no longer linked to your account.
          </li>
        </List>
        <p>
          If you&apos;re not satisfied with how we handle a privacy concern, you can contact the{" "}
          <a href="https://www.priv.gc.ca/" className="link" target="_blank" rel="noopener noreferrer">
            Office of the Privacy Commissioner of Canada
          </a>
          .
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If we make significant changes to this policy, we&apos;ll update the date above and notify
          users in the app. Questions? Email <ContactEmail />.
        </p>
      </Section>
    </LegalPage>
  );
}
