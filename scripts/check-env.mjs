// Runs before migrations on deploy (see `start:prod`). Fails fast with a clear
// message instead of a cryptic Prisma error when required settings are missing.
const required = {
  DATABASE_URL: "On Railway: WaterlooMarket service → Variables → add a reference to Postgres → DATABASE_URL.",
};
const recommended = {
  APP_URL: "Email links will point at http://localhost:3000.",
  CONTACT_EMAIL: "/privacy and /terms will show a [set CONTACT_EMAIL] placeholder.",
  CRON_SECRET: "/api/cron/daily will reject every request, so daily jobs won't run.",
  UPLOAD_DIR: "Photos are saved inside the app folder and lost on every redeploy.",
};

const missing = Object.keys(required).filter((k) => !process.env[k]?.trim());
for (const key of missing) {
  console.error(`✖ Missing required setting ${key}. ${required[key]}`);
}
for (const [key, why] of Object.entries(recommended)) {
  if (!process.env[key]?.trim()) console.warn(`⚠ ${key} is not set. ${why}`);
}
if (!process.env.RESEND_API_KEY?.trim() && !process.env.SMTP_URL?.trim()) {
  console.warn("⚠ Neither RESEND_API_KEY nor SMTP_URL is set. Emails (including sign-up verification) will only be printed to the logs.");
}
if (missing.length) process.exit(1);
