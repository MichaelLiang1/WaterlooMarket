import "server-only";
import nodemailer from "nodemailer";

type Email = { to: string; subject: string; text: string };

const FROM = process.env.EMAIL_FROM ?? "Waterloo Market <no-reply@localhost>";

export function appUrl(path = "") {
  return `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}${path}`;
}

let transport: ReturnType<typeof nodemailer.createTransport> | undefined;

/**
 * Sends via Resend if RESEND_API_KEY is set, SMTP if SMTP_URL is set,
 * otherwise prints the email to the server console (development).
 * Never throws: a failed notification email shouldn't fail the user's action.
 */
export async function sendEmail({ to, subject, text }: Email) {
  try {
    if (process.env.RESEND_API_KEY) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: FROM, to, subject, text }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
      return;
    }
    if (process.env.SMTP_URL) {
      transport ??= nodemailer.createTransport(process.env.SMTP_URL);
      await transport.sendMail({ from: FROM, to, subject, text });
      return;
    }
    console.log(
      `\n──── email (dev) ────\nTo: ${to}\nSubject: ${subject}\n\n${text}\n─────────────────────\n`,
    );
  } catch (err) {
    console.error("Failed to send email", { to, subject, err });
  }
}
