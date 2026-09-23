import "server-only";
import { headers } from "next/headers";
import { db } from "./db";

/**
 * Sliding-window limiter backed by Postgres, so it works across server
 * instances. Records a hit and returns true if the caller is under the limit.
 */
export async function rateLimit(key: string, limit: number, windowMs: number) {
  const since = new Date(Date.now() - windowMs);
  const recent = await db.rateLimitHit.count({
    where: { key, createdAt: { gte: since } },
  });
  if (recent >= limit) return false;
  await db.rateLimitHit.create({ data: { key } });
  // Opportunistic cleanup so the table doesn't grow forever.
  if (Math.random() < 0.01) {
    await db.rateLimitHit.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
  }
  return true;
}

export async function clientIp() {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Central place for the product's anti-spam limits. */
export const LIMITS = {
  login: { limit: 10, windowMs: 15 * MINUTE },
  signup: { limit: 5, windowMs: HOUR },
  emailSend: { limit: 5, windowMs: HOUR },
  listingsPerDay: { limit: 15, windowMs: DAY },
  requestsPerHour: { limit: 20, windowMs: HOUR },
  messagesPerMinute: { limit: 20, windowMs: MINUTE },
  reportsPerDay: { limit: 10, windowMs: DAY },
  alerts: { max: 10 },
} as const;
