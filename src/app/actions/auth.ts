"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, fieldErrorsFrom, ok, type ActionState } from "@/lib/action-state";
import {
  allowedEmailDomains,
  consumeEmailToken,
  createEmailToken,
  createSession,
  destroyAllSessions,
  destroySession,
  getCurrentUser,
  hashPassword,
  isAdminEmail,
  isSchoolEmail,
  normalizeEmail,
  requireUser,
  verifyPassword,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { appUrl, sendEmail } from "@/lib/email";
import { LIMITS, clientIp, rateLimit } from "@/lib/rate-limit";
import { passwordSchema, profileSchema } from "@/lib/validation";

const TOO_MANY = "Too many attempts. Please wait a bit and try again.";

function safeNext(next: FormDataEntryValue | null) {
  const value = typeof next === "string" ? next : "";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

async function sendVerificationEmail(userId: string, email: string, name: string) {
  const token = await createEmailToken(userId, "VERIFY_EMAIL");
  await sendEmail({
    to: email,
    subject: "Confirm your Waterloo Market email",
    text: `Hi ${name},\n\nConfirm that this is your email by opening the link below (valid for 24 hours):\n\n${appUrl(`/verify?token=${token}`)}\n\nIf you didn't sign up, you can ignore this email.`,
  });
}

const signupSchema = profileSchema.extend({
  email: z.email("Enter a valid email.").transform(normalizeEmail),
  password: passwordSchema,
});

export async function signup(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFrom(parsed.error.issues));
  }
  const { email, password, name, program, year } = parsed.data;
  if (!isSchoolEmail(email)) {
    return fail("Use your school email.", {
      email: `Sign up with your @${allowedEmailDomains()[0]} address.`,
    });
  }
  if (!(await rateLimit(`signup:${await clientIp()}`, LIMITS.signup.limit, LIMITS.signup.windowMs))) {
    return fail(TOO_MANY);
  }
  if (await db.user.findUnique({ where: { email } })) {
    return fail("That email already has an account.", {
      email: "Already registered. Log in or reset your password.",
    });
  }
  const user = await db.user.create({
    data: {
      email,
      name,
      program,
      year,
      passwordHash: await hashPassword(password),
      role: isAdminEmail(email) ? "ADMIN" : "USER",
    },
  });
  await sendVerificationEmail(user.id, user.email, user.name);
  await createSession(user.id);
  redirect("/verify-email");
}

export async function login(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const ip = await clientIp();
  const allowed =
    (await rateLimit(`login:ip:${ip}`, LIMITS.login.limit * 3, LIMITS.login.windowMs)) &&
    (await rateLimit(`login:email:${email}`, LIMITS.login.limit, LIMITS.login.windowMs));
  if (!allowed) return fail(TOO_MANY);

  const user = await db.user.findUnique({ where: { email } });
  // Always run bcrypt so response time doesn't reveal whether the email exists.
  const valid = await verifyPassword(
    password,
    user?.passwordHash ?? "$2b$12$2Qvfl19xOBK9XHurVpHZXuOp7FDW0LvnxEFbx9wlc5zE67UUkkaiO",
  );
  if (!user || !valid) return fail("Email or password is incorrect.");
  if (user.bannedAt) {
    return fail(`This account has been suspended${user.banReason ? `: ${user.banReason}` : "."}`);
  }
  await createSession(user.id);
  redirect(user.emailVerifiedAt ? safeNext(formData.get("next")) : "/verify-email");
}

export async function logout() {
  await destroySession();
  redirect("/");
}

export async function resendVerification(): Promise<ActionState> {
  const user = await requireUser();
  if (user.emailVerifiedAt) redirect("/");
  if (!(await rateLimit(`verify:${user.id}`, LIMITS.emailSend.limit, LIMITS.emailSend.windowMs))) {
    return fail(TOO_MANY);
  }
  await sendVerificationEmail(user.id, user.email, user.name);
  return ok(`Sent a new link to ${user.email}.`);
}

export async function requestPasswordReset(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const done = ok("If that email has an account, a reset link is on its way.");
  if (!(await rateLimit(`reset:${await clientIp()}`, LIMITS.emailSend.limit, LIMITS.emailSend.windowMs))) {
    return fail(TOO_MANY);
  }
  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.bannedAt) return done;
  const token = await createEmailToken(user.id, "RESET_PASSWORD");
  await sendEmail({
    to: user.email,
    subject: "Reset your Waterloo Market password",
    text: `Hi ${user.name},\n\nReset your password with this link (valid for 1 hour):\n\n${appUrl(`/reset-password?token=${token}`)}\n\nIf you didn't ask for this, you can ignore this email.`,
  });
  return done;
}

export async function resetPassword(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!parsed.success) return fail(parsed.error.issues[0].message, { password: parsed.error.issues[0].message });
  if (formData.get("password") !== formData.get("confirm")) {
    return fail("Passwords don't match.", { confirm: "Passwords don't match." });
  }
  const userId = await consumeEmailToken(String(formData.get("token") ?? ""), "RESET_PASSWORD");
  if (!userId) return fail("This reset link is invalid or has expired. Request a new one.");
  await db.user.update({
    where: { id: userId },
    // Opening the emailed link also proves they own the address.
    data: { passwordHash: await hashPassword(parsed.data), emailVerifiedAt: new Date() },
  });
  await destroyAllSessions(userId);
  await createSession(userId);
  redirect("/?reset=1");
}

export async function updateProfile(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFrom(parsed.error.issues));
  }
  await db.user.update({
    where: { id: user.id },
    data: { ...parsed.data, emailNotifications: formData.get("emailNotifications") === "on" },
  });
  return ok("Profile saved.");
}

export async function changePassword(_: ActionState, formData: FormData): Promise<ActionState> {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  const user = await db.user.findUniqueOrThrow({ where: { id: current.id } });
  if (!(await verifyPassword(String(formData.get("current") ?? ""), user.passwordHash))) {
    return fail("Current password is incorrect.", { current: "Incorrect password." });
  }
  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!parsed.success) return fail(parsed.error.issues[0].message, { password: parsed.error.issues[0].message });
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data) },
  });
  // Sign out other devices, keep this one.
  await destroyAllSessions(user.id);
  await createSession(user.id);
  return ok("Password changed. Other devices have been signed out.");
}
