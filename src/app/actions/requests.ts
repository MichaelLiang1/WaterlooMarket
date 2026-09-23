"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { requireVerifiedUser } from "@/lib/auth";
import { DATED_KINDS, REQUESTABLE_KINDS } from "@/lib/constants";
import { db } from "@/lib/db";
import { isConstraintViolation } from "@/lib/db-errors";
import { formatDay, parseDateInput, todayDate } from "@/lib/format";
import { publicListingWhere } from "@/lib/listings";
import { notify } from "@/lib/notify";
import { LIMITS, rateLimit } from "@/lib/rate-limit";

const OVERLAP = "ListingRequest_no_overlap";
const ONE_SALE = "ListingRequest_one_accepted_sale";

function revalidateRequestPages(listingId: string) {
  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/my/requests");
  revalidatePath("/my/listings");
}

export async function createRequest(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser();
  const listing = await db.listing.findFirst({
    where: { id: String(formData.get("listingId")), ...publicListingWhere() },
  });
  if (!listing) return fail("This listing is no longer available.");
  if (listing.ownerId === user.id) return fail("You can't request your own listing.");
  if (!REQUESTABLE_KINDS.includes(listing.kind)) return fail("This listing doesn't take requests. Message the poster instead.");

  const message = String(formData.get("message") ?? "").trim().slice(0, 1000);
  const dated = DATED_KINDS.includes(listing.kind);
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  if (dated) {
    startDate = parseDateInput(String(formData.get("startDate") ?? ""));
    endDate = parseDateInput(String(formData.get("endDate") ?? ""));
    if (!startDate || !endDate) return fail("Pick the dates you need it.", { startDate: "Required." });
    if (startDate > endDate) return fail("End date must be on or after the start date.", { endDate: "Must be after the start." });
    if (startDate < todayDate()) return fail("Start date can't be in the past.", { startDate: "Pick today or later." });
    if (
      (listing.availableFrom && startDate < listing.availableFrom) ||
      (listing.availableUntil && endDate > listing.availableUntil)
    ) {
      return fail(
        `Pick dates between ${formatDay(listing.availableFrom)} and ${formatDay(listing.availableUntil)}.`,
      );
    }
    const clash = await db.listingRequest.findFirst({
      where: {
        listingId: listing.id,
        status: { in: ["ACCEPTED", "COMPLETED"] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });
    if (clash) {
      return fail(`Already booked ${formatDay(clash.startDate)} – ${formatDay(clash.endDate)}. Try other dates.`);
    }
  } else if (listing.status !== "ACTIVE") {
    return fail("This item is reserved for someone else right now.");
  }

  const duplicate = await db.listingRequest.findFirst({
    where: { listingId: listing.id, requesterId: user.id, status: "PENDING" },
  });
  if (duplicate) return fail("You already have a pending request on this listing.");

  if (!(await rateLimit(`request:${user.id}`, LIMITS.requestsPerHour.limit, LIMITS.requestsPerHour.windowMs))) {
    return fail("You're sending requests too quickly. Try again later.");
  }

  await db.listingRequest.create({
    data: { listingId: listing.id, requesterId: user.id, startDate, endDate, message },
  });
  await notify({
    userId: listing.ownerId,
    type: "request_new",
    title: `New request for "${listing.title}"`,
    body: [
      `${user.name} wants ${dated ? `to book it ${formatDay(startDate)} – ${formatDay(endDate)}` : "to buy it"}.`,
      message ? `\n"${message}"` : "",
    ].join(""),
    link: "/my/requests?tab=incoming",
  });
  revalidateRequestPages(listing.id);
  return ok("Request sent! You'll be notified when the owner responds.");
}

const respondSchema = z.object({
  requestId: z.string(),
  decision: z.enum(["accept", "decline"]),
});

export async function respondToRequest(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser();
  const parsed = respondSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Invalid request.");
  const request = await db.listingRequest.findUnique({
    where: { id: parsed.data.requestId },
    include: { listing: true, requester: true },
  });
  if (!request || request.listing.ownerId !== user.id) return fail("Request not found.");
  if (request.status !== "PENDING") return fail("This request was already handled.");
  const { listing } = request;

  if (parsed.data.decision === "decline") {
    await db.listingRequest.update({
      where: { id: request.id },
      data: { status: "DECLINED", respondedAt: new Date() },
    });
    await notify({
      userId: request.requesterId,
      type: "request_declined",
      title: `Request declined: "${listing.title}"`,
      body: "The owner declined your request. Keep browsing — there's plenty more.",
      link: "/my/requests",
    });
    revalidateRequestPages(listing.id);
    return ok("Declined.");
  }

  const dated = request.startDate !== null;
  try {
    if (dated) {
      await db.listingRequest.update({
        where: { id: request.id },
        data: { status: "ACCEPTED", respondedAt: new Date() },
      });
    } else {
      if (listing.status !== "ACTIVE") return fail("Release the current reservation before accepting another buyer.");
      await db.$transaction([
        db.listingRequest.update({
          where: { id: request.id },
          data: { status: "ACCEPTED", respondedAt: new Date() },
        }),
        db.listing.update({ where: { id: listing.id }, data: { status: "RESERVED" } }),
      ]);
    }
  } catch (err) {
    if (isConstraintViolation(err, OVERLAP)) {
      return fail("Those dates overlap a booking you've already accepted.");
    }
    if (isConstraintViolation(err, ONE_SALE)) {
      return fail("You've already accepted another buyer for this item.");
    }
    throw err;
  }

  // Auto-decline pending requests that can no longer be fulfilled.
  const conflicting = dated
    ? await db.listingRequest.findMany({
        where: {
          listingId: listing.id,
          status: "PENDING",
          startDate: { lte: request.endDate! },
          endDate: { gte: request.startDate! },
        },
      })
    : [];
  if (conflicting.length) {
    await db.listingRequest.updateMany({
      where: { id: { in: conflicting.map((r) => r.id) } },
      data: { status: "DECLINED", respondedAt: new Date() },
    });
    await Promise.all(
      conflicting.map((r) =>
        notify({
          userId: r.requesterId,
          type: "request_declined",
          title: `Dates unavailable: "${listing.title}"`,
          body: "Someone else booked overlapping dates first. Try different dates.",
          link: `/listings/${listing.id}`,
        }),
      ),
    );
  }

  await notify({
    userId: request.requesterId,
    type: "request_accepted",
    title: `Request accepted: "${listing.title}"`,
    body: [
      dated
        ? `You're booked ${formatDay(request.startDate)} – ${formatDay(request.endDate)}.`
        : "The seller is holding it for you.",
      `Contact ${user.name} at ${user.email} (or reply in Messages) to arrange pickup.`,
      listing.depositCents ? `The owner asks for a $${(listing.depositCents / 100).toFixed(2)} deposit, handled in person.` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    link: "/my/requests",
  });
  revalidateRequestPages(listing.id);
  return ok(`Accepted. You can reach ${request.requester.name} at ${request.requester.email}.`);
}

export async function cancelRequest(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser();
  const request = await db.listingRequest.findUnique({
    where: { id: String(formData.get("requestId")) },
    include: { listing: true },
  });
  if (!request || request.requesterId !== user.id) return fail("Request not found.");
  if (request.status !== "PENDING" && request.status !== "ACCEPTED") {
    return fail("This request can't be cancelled.");
  }
  if (request.status === "ACCEPTED" && request.startDate && request.startDate <= todayDate()) {
    return fail("This rental has already started. Message the owner to sort it out.");
  }
  const releasesSale = request.status === "ACCEPTED" && request.startDate === null;
  await db.$transaction([
    db.listingRequest.update({ where: { id: request.id }, data: { status: "CANCELLED" } }),
    ...(releasesSale && request.listing.status === "RESERVED"
      ? [db.listing.update({ where: { id: request.listingId }, data: { status: "ACTIVE" } })]
      : []),
  ]);
  await notify({
    userId: request.listing.ownerId,
    type: "request_cancelled",
    title: `Request cancelled: "${request.listing.title}"`,
    body: `${user.name} cancelled their ${request.status === "ACCEPTED" ? "accepted " : ""}request.${releasesSale ? " The item is active again." : ""}`,
    link: "/my/requests?tab=incoming",
  });
  revalidateRequestPages(request.listingId);
  return ok("Request cancelled.");
}

/** Owner marks a rental/storage booking as finished (item returned). */
export async function completeRequest(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser();
  const request = await db.listingRequest.findUnique({
    where: { id: String(formData.get("requestId")) },
    include: { listing: true },
  });
  if (!request || request.listing.ownerId !== user.id) return fail("Request not found.");
  if (request.status !== "ACCEPTED" || !request.startDate) return fail("Only accepted bookings can be completed.");
  await db.listingRequest.update({ where: { id: request.id }, data: { status: "COMPLETED" } });
  await notify({
    userId: request.requesterId,
    type: "request_completed",
    title: `Booking complete: "${request.listing.title}"`,
    body: "Thanks for using Waterloo Market! Leave the owner a review.",
    link: "/my/requests?tab=past",
  });
  revalidateRequestPages(request.listingId);
  return ok("Marked as complete.");
}
