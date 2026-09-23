import "server-only";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { TokenType } from "@/generated/prisma/enums";
import { db } from "./db";

const SESSION_COOKIE = "wm_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function allowedEmailDomains() {
  return (process.env.ALLOWED_EMAIL_DOMAINS ?? "uwaterloo.ca")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isSchoolEmail(email: string) {
  const domain = normalizeEmail(email).split("@")[1];
  return !!domain && allowedEmailDomains().includes(domain);
}

export function isAdminEmail(email: string) {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => normalizeEmail(e))
    .includes(normalizeEmail(email));
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function newToken() {
  return randomBytes(32).toString("base64url");
}

export async function createSession(userId: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({
    data: { userId, tokenHash: sha256(token), expiresAt },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  }
  jar.delete(SESSION_COOKIE);
}

export async function destroyAllSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}

/** The signed-in, non-banned user for this request, or null. */
export const getCurrentUser = cache(async () => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { omit: { passwordHash: true } } },
  });
  if (!session || session.expiresAt < new Date() || session.user.bannedAt) {
    return null;
  }
  return session.user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Signed in (may be unverified). Redirects to login otherwise. */
export async function requireUser(next?: string) {
  const user = await getCurrentUser();
  if (!user) {
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }
  return user;
}

/** Signed in with a verified school email. Needed for anything that touches other people. */
export async function requireVerifiedUser(next?: string) {
  const user = await requireUser(next);
  if (!user.emailVerifiedAt) redirect("/verify-email");
  return user;
}

export async function requireAdmin() {
  const user = await requireVerifiedUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

const TOKEN_TTL_MS: Record<TokenType, number> = {
  VERIFY_EMAIL: 24 * 60 * 60 * 1000,
  RESET_PASSWORD: 60 * 60 * 1000,
};

/** Creates a single-use token and returns the raw value to put in a link. */
export async function createEmailToken(userId: string, type: TokenType) {
  const token = newToken();
  await db.emailToken.deleteMany({ where: { userId, type, usedAt: null } });
  await db.emailToken.create({
    data: {
      userId,
      type,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS[type]),
    },
  });
  return token;
}

/** Marks the token used and returns its userId, or null if invalid/expired/used. */
export async function consumeEmailToken(token: string, type: TokenType) {
  const row = await db.emailToken.findUnique({
    where: { tokenHash: sha256(token) },
  });
  if (!row || row.type !== type || row.usedAt || row.expiresAt < new Date()) {
    return null;
  }
  const { count } = await db.emailToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  return count === 1 ? row.userId : null;
}
