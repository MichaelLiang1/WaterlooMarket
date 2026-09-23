/** Where privacy requests and legal questions go. Set CONTACT_EMAIL in production. */
export function contactEmail() {
  return process.env.CONTACT_EMAIL || null;
}

/** Bump when the privacy policy or terms change materially. */
export const LEGAL_LAST_UPDATED = "September 23, 2026";
