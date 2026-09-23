import "server-only";
import type { Listing } from "@/generated/prisma/client";
import { KIND_LABELS } from "./constants";
import { db } from "./db";
import { appUrl, sendEmail } from "./email";
import { formatPrice } from "./format";

type NotifyInput = {
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  /** Also email the user (if they have email notifications on). Default true. */
  email?: boolean;
};

/** Creates an in-app notification and, optionally, emails it. */
export async function notify({ userId, type, title, body = "", link, email = true }: NotifyInput) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, emailNotifications: true, bannedAt: true },
  });
  if (!user || user.bannedAt) return;
  await db.notification.create({ data: { userId, type, title, body, link } });
  if (email && user.emailNotifications) {
    await sendEmail({
      to: user.email,
      subject: title,
      text: [
        body,
        link ? `\nOpen: ${appUrl(link)}` : "",
        `\n—\nWaterloo Market · Turn off email notifications at ${appUrl("/account")}`,
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }
}

/** Notify everyone whose saved alert matches a newly posted listing. */
export async function notifyMatchingAlerts(listing: Listing) {
  const alerts = await db.alert.findMany({
    where: {
      active: true,
      userId: { not: listing.ownerId },
      AND: [
        { OR: [{ category: null }, { category: listing.category }] },
        // Alerts without a kind are for things you can get, not other people's Wanted posts.
        listing.kind === "WANTED"
          ? { kind: "WANTED" }
          : { OR: [{ kind: null }, { kind: listing.kind }] },
        { OR: [{ neighbourhood: null }, { neighbourhood: listing.neighbourhood }] },
        { OR: [{ maxPriceCents: null }, { maxPriceCents: { gte: listing.priceCents } }] },
      ],
    },
  });
  const haystack = `${listing.title} ${listing.description}`.toLowerCase();
  const matches = alerts.filter(
    (a) => !a.keyword || haystack.includes(a.keyword.toLowerCase()),
  );
  // One notification per user even if several of their alerts match.
  const userIds = [...new Set(matches.map((a) => a.userId))];
  await Promise.all(
    userIds.map((userId) =>
      notify({
        userId,
        type: "alert_match",
        title: `New match: ${listing.title}`,
        body: `${KIND_LABELS[listing.kind]} · ${formatPrice(listing.priceCents, listing.priceUnit)} · ${listing.neighbourhood}`,
        link: `/listings/${listing.id}`,
      }),
    ),
  );
}
