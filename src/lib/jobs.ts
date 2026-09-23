import "server-only";
import { db } from "./db";
import { formatDay, todayDate } from "./format";
import { notify } from "./notify";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Daily housekeeping. Idempotent, so it's safe to run more than once a day.
 * Trigger with: curl -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/cron/daily
 */
export async function runDailyJobs(now = new Date()) {
  const today = todayDate();

  // 1. Prompt owners to renew listings that expire within 3 days.
  const expiring = await db.listing.findMany({
    where: {
      status: { in: ["ACTIVE", "RESERVED"] },
      expiryWarnedAt: null,
      expiresAt: { gt: now, lte: new Date(now.getTime() + 3 * DAY) },
    },
  });
  for (const listing of expiring) {
    await notify({
      userId: listing.ownerId,
      type: "listing_expiring",
      title: `"${listing.title}" expires ${formatDay(listing.expiresAt)}`,
      body: "Still available? Renew it from My listings to keep it in the feed for another 30 days.",
      link: "/my/listings",
    });
    await db.listing.update({ where: { id: listing.id }, data: { expiryWarnedAt: now } });
  }

  // 2. Bookings whose end date has passed are complete; invite both sides to review.
  const finished = await db.listingRequest.findMany({
    where: { status: "ACCEPTED", endDate: { lt: today } },
    include: { listing: true },
  });
  for (const request of finished) {
    await db.listingRequest.update({ where: { id: request.id }, data: { status: "COMPLETED" } });
    for (const userId of [request.requesterId, request.listing.ownerId]) {
      await notify({
        userId,
        type: "request_completed",
        title: `How did it go? "${request.listing.title}"`,
        body: "Your booking has ended. Leave a review to help other students.",
        link: "/my/requests?tab=past",
      });
    }
  }

  // 3. Pending date requests that were never answered and have now started are stale.
  const stale = await db.listingRequest.updateMany({
    where: { status: "PENDING", startDate: { lt: today } },
    data: { status: "CANCELLED" },
  });

  // 4. Clean up expired auth rows and rate-limit hits (which contain IP
  //    addresses; the privacy policy promises these don't outlive ~2 days).
  await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  await db.emailToken.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - DAY) } } });
  await db.rateLimitHit.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - DAY) } } });

  return {
    expiryWarnings: expiring.length,
    completedBookings: finished.length,
    staleRequests: stale.count,
  };
}
