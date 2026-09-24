# Waterloo Market

A marketplace for UWaterloo students to sell, rent, and store their stuff before leaving for co-op.

Next.js 16 (App Router, server actions) · Prisma 7 · PostgreSQL · Tailwind CSS 4

## Getting started

```bash
npm install
cp .env.example .env
npm run db:dev        # terminal 1: local Postgres on :5433 (no Docker needed)
npm run db:deploy     # apply migrations
npm run db:seed       # optional demo data; every password is "password123"
npm run dev           # terminal 2: http://localhost:3000
```

Seeded accounts: `admin@uwaterloo.ca`, `alex@uwaterloo.ca`, `priya@uwaterloo.ca`, `sam@uwaterloo.ca`.

In development, emails (verification, password reset, notifications) are **printed to the
`npm run dev` console**. Copy the link from there. Set `RESEND_API_KEY` or `SMTP_URL` to send real email.

## Checks

```bash
npm test            # unit + database-rule tests (needs db:dev running)
npm run typecheck
npm run lint
```

## Features

**Accounts** — school-email sign up (`ALLOWED_EMAIL_DOMAINS`), email verification, bcrypt
passwords, DB-backed sessions (httpOnly cookie, hashed token), logout, password reset (signs out
other devices), profile with program and year.

Set `SIGNUP_VERIFICATION=manual` to skip confirmation emails: new accounts wait in a
"Waiting for approval" list in `/admin` until an admin approves or rejects them, and admins get
a notification for each sign-up. `ADMIN_EMAILS` accounts are approved automatically. Useful until
you have a sending domain; switch back to `email` (the default) afterwards. The pending list also
shows unconfirmed accounts in email mode, so you can let someone in by hand.

**Listings** — five kinds: *for sale*, *for rent*, *storage offered* ("I'll store your things for
$X/term"), *wanted*, and *sublet* (with city and an external link, for work-term cities). Categories,
condition, price with rental period, optional deposit (tracked, handled in person), general pickup
area (never an exact address), up to 8 photos (validated by file signature), mark
reserved/sold/unavailable, edit, delete, "My listings".

**Discovery** — newest-first feed, keyword search, filters for type, category, price range,
and neighbourhood/residence, sorting, pagination.

**Renting and buying** — request dates (with one-tap Winter/Spring/Fall term presets) or ask to buy.
The owner accepts or declines. **Double-booking is impossible**: a Postgres exclusion constraint
rejects overlapping accepted bookings, and a partial unique index allows only one accepted buyer per
sale item. Accepting a buyer reserves the item; accepting dates auto-declines overlapping pending
requests. The availability calendar shows booked days.

**Contact** — once a request is accepted, both sides see each other's email. There's also in-app
messaging per listing, with email notifications (one per burst of messages, not one per line).

**Trust and safety** — two-way reviews after a completed transaction, reporting listings and users,
rate limits (signups, logins, listings/day, requests, messages, reports), and an admin panel (`/admin`)
with a report queue, listing removal/restore, and user ban/unban. Banned users are signed out and
their listings hidden.

**Convenience** — saved listings, "My requests" (pending / on my listings / past), notifications
page, listings expire after 30 days with a renewal reminder, mobile layout with a bottom tab bar.

**Co-op features** — *move-out bundles* (list a whole room in one form with a move-out date; items
expire after that date and the feed shows "Moving out soon"), term-aware date presets, storage
listings, sublet cross-listings, wanted posts, neighbourhood/residence filter, and *search alerts*
("notify me when a desk is posted under $40").

## Daily job

`/api/cron/daily` sends expiry reminders, marks finished rentals complete (which unlocks reviews),
cancels stale pending requests, and cleans up expired sessions and rate-limit records (the
privacy policy promises IP addresses are deleted within about two days, so this job must run).

[.github/workflows/daily-jobs.yml](.github/workflows/daily-jobs.yml) calls it every day at
13:00 UTC. To enable it, go to the GitHub repo → Settings → Secrets and variables → Actions and add:

- a **variable** `APP_URL` (for example `https://waterloomarket.ca`)
- a **secret** `CRON_SECRET` (the same value as the app's `CRON_SECRET`)

Then use **Actions → Daily jobs → Run workflow** to test it. On a public repo, GitHub pauses
scheduled workflows after 60 days with no commits; re-enable it from the Actions tab if that happens.

## Privacy & terms

`/privacy` and `/terms` are linked from the footer and the sign-up form. Set `CONTACT_EMAIL`, or
the pages show a red `[set CONTACT_EMAIL]` placeholder. They're a plain-language starting
point written to match what the code actually does; have someone qualified review them before
launch, and update them (and `LEGAL_LAST_UPDATED` in `src/lib/site.ts`) if you change what data
the app collects or who can see it. Account deletion is currently handled by email request.

Uploaded photos are re-encoded with `sharp` to strip EXIF metadata (including GPS location),
fix rotation, and cap them at 2000px.

## Deploying notes

- Use any managed Postgres (Neon, Supabase, RDS, …). Run `npm run db:deploy` on release.
- Photos are stored on local disk in `UPLOAD_DIR`. On hosts with an ephemeral filesystem
  (Vercel, most containers), mount a volume or replace the three functions in `src/lib/uploads.ts`
  with S3/R2 calls.
- Set `ADMIN_EMAILS` to make your account an admin, and `CONTACT_EMAIL` for the legal pages.

## Layout

```
prisma/schema.prisma            data model
prisma/migrations/*/            includes hand-written exclusion constraint + checks
src/lib/                        auth, db, email, rate limits, terms, validation, jobs
src/app/actions/                server actions (auth, listings, requests, messages, social, admin)
src/app/                        pages and route handlers
src/components/                 UI components
tests/                          node:test suite
```
