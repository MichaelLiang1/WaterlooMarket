"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Category, ListingKind } from "@/generated/prisma/enums";
import { fail, fieldErrorsFrom, ok, type ActionState } from "@/lib/action-state";
import { requireUser, requireVerifiedUser } from "@/lib/auth";
import { REPORT_REASONS } from "@/lib/constants";
import { db } from "@/lib/db";
import { dollarsToCents } from "@/lib/format";
import { notify } from "@/lib/notify";
import { LIMITS, rateLimit } from "@/lib/rate-limit";

// ─── Favorites ───────────────────────────────────────────────────────────────

export async function toggleFavorite(_: ActionState, formData: FormData): Promise<ActionState> {
  const listingId = String(formData.get("listingId"));
  const user = await requireUser(`/listings/${listingId}`);
  const key = { userId_listingId: { userId: user.id, listingId } };
  const existing = await db.favorite.findUnique({ where: key });
  if (existing) {
    await db.favorite.delete({ where: key });
  } else {
    if (!(await db.listing.findUnique({ where: { id: listingId }, select: { id: true } }))) {
      return fail("Listing not found.");
    }
    await db.favorite.create({ data: { userId: user.id, listingId } });
  }
  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/my/saved");
  return ok(existing ? "Removed from saved." : "Saved.");
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

const reviewSchema = z.object({
  requestId: z.string(),
  rating: z.coerce.number().int().min(1, "Pick a rating.").max(5),
  comment: z.string().trim().max(1000).default(""),
});

export async function submitReview(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser();
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Pick a rating from 1 to 5 stars.", fieldErrorsFrom(parsed.error.issues));
  const request = await db.listingRequest.findUnique({
    where: { id: parsed.data.requestId },
    include: { listing: true },
  });
  if (!request) return fail("Transaction not found.");
  const isBuyer = request.requesterId === user.id;
  const isOwner = request.listing.ownerId === user.id;
  if (!isBuyer && !isOwner) return fail("You weren't part of this transaction.");
  if (request.status !== "COMPLETED") return fail("You can review once the transaction is complete.");
  const revieweeId = isBuyer ? request.listing.ownerId : request.requesterId;

  const existing = await db.review.findUnique({
    where: { requestId_reviewerId: { requestId: request.id, reviewerId: user.id } },
  });
  if (existing) return fail("You've already reviewed this transaction.");

  await db.review.create({
    data: {
      requestId: request.id,
      reviewerId: user.id,
      revieweeId,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    },
  });
  await notify({
    userId: revieweeId,
    type: "review_new",
    title: `${user.name} left you a ${parsed.data.rating}-star review`,
    body: parsed.data.comment,
    link: `/users/${revieweeId}`,
    email: false,
  });
  revalidatePath("/my/requests");
  revalidatePath(`/users/${revieweeId}`);
  return ok("Thanks for the review!");
}

// ─── Reports ─────────────────────────────────────────────────────────────────

const reportSchema = z.object({
  listingId: z.string().optional(),
  userId: z.string().optional(),
  reason: z.enum(REPORT_REASONS, "Pick a reason."),
  details: z.string().trim().max(2000).default(""),
});

export async function submitReport(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser();
  const parsed = reportSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Pick a reason.", fieldErrorsFrom(parsed.error.issues));
  const { listingId, userId, reason, details } = parsed.data;
  if (!listingId && !userId) return fail("Nothing to report.");

  let reportedUserId = userId ?? null;
  if (listingId) {
    const listing = await db.listing.findUnique({ where: { id: listingId } });
    if (!listing) return fail("Listing not found.");
    reportedUserId = listing.ownerId;
  } else if (!(await db.user.findUnique({ where: { id: userId } }))) {
    return fail("User not found.");
  }
  if (reportedUserId === user.id) return fail("You can't report yourself.");
  if (!(await rateLimit(`report:${user.id}`, LIMITS.reportsPerDay.limit, LIMITS.reportsPerDay.windowMs))) {
    return fail("You've sent a lot of reports today. Our moderators will get to them.");
  }
  await db.report.create({
    data: { reporterId: user.id, listingId: listingId ?? null, reportedUserId, reason, details },
  });
  return ok("Thanks. A moderator will take a look.");
}

// ─── Alerts (saved searches) ─────────────────────────────────────────────────

const alertSchema = z.object({
  keyword: z.string().trim().max(60).optional(),
  category: z.union([z.enum(Category), z.literal("")]).optional(),
  kind: z.union([z.enum(ListingKind), z.literal("")]).optional(),
  maxPrice: z.string().optional(),
  neighbourhood: z.string().trim().max(60).optional(),
});

export async function createAlert(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser();
  const parsed = alertSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please check the alert fields.");
  const { keyword, category, kind, maxPrice, neighbourhood } = parsed.data;
  const maxPriceCents = maxPrice?.trim() ? dollarsToCents(maxPrice) : null;
  if (maxPrice?.trim() && maxPriceCents === null) return fail("Enter a valid max price.", { maxPrice: "Invalid price." });
  if (!keyword && !category && !kind && maxPriceCents === null && !neighbourhood) {
    return fail("Add at least one condition, like a keyword or category.");
  }
  const count = await db.alert.count({ where: { userId: user.id } });
  if (count >= LIMITS.alerts.max) return fail(`You can have up to ${LIMITS.alerts.max} alerts.`);
  await db.alert.create({
    data: {
      userId: user.id,
      keyword: keyword || null,
      category: category || null,
      kind: kind || null,
      maxPriceCents,
      neighbourhood: neighbourhood || null,
    },
  });
  revalidatePath("/alerts");
  if (formData.get("redirectTo") === "alerts") redirect("/alerts?created=1");
  return ok("Alert saved. We'll notify you when something matches.");
}

export async function deleteAlert(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  await db.alert.deleteMany({ where: { id: String(formData.get("alertId")), userId: user.id } });
  revalidatePath("/alerts");
  return ok("Alert deleted.");
}

export async function toggleAlert(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const alert = await db.alert.findFirst({
    where: { id: String(formData.get("alertId")), userId: user.id },
  });
  if (!alert) return fail("Alert not found.");
  await db.alert.update({ where: { id: alert.id }, data: { active: !alert.active } });
  revalidatePath("/alerts");
  return ok(alert.active ? "Paused." : "Resumed.");
}
