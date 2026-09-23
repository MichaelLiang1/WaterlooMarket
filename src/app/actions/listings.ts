"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ListingStatus } from "@/generated/prisma/enums";
import { Category, Condition } from "@/generated/prisma/enums";
import { fail, fieldErrorsFrom, ok, type ActionState } from "@/lib/action-state";
import { requireVerifiedUser } from "@/lib/auth";
import { MAX_PHOTOS, NEIGHBOURHOODS } from "@/lib/constants";
import { db } from "@/lib/db";
import { dollarsToCents, parseDateInput, todayDate } from "@/lib/format";
import { bundleExpiry, defaultExpiry } from "@/lib/listings";
import { notify, notifyMatchingAlerts } from "@/lib/notify";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { UploadError, deleteImages, saveImage } from "@/lib/uploads";
import { parseListingForm } from "@/lib/validation";

function filesFrom(formData: FormData, name: string) {
  return formData
    .getAll(name)
    .filter((f): f is File => f instanceof File && f.size > 0);
}

/** Saves all files or none; cleans up partial uploads on failure. */
async function saveAll(files: File[]) {
  const keys: string[] = [];
  try {
    for (const file of files) keys.push(await saveImage(file));
    return keys;
  } catch (err) {
    await deleteImages(keys);
    throw err;
  }
}

async function ownedListing(listingId: string, userId: string) {
  const listing = await db.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.ownerId !== userId) return null;
  return listing;
}

export async function createListing(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser();
  const parsed = parseListingForm(formData);
  if ("fieldErrors" in parsed) return fail("Please fix the highlighted fields.", parsed.fieldErrors);
  const input = parsed.data;

  let expiresAt = defaultExpiry();
  if (input.bundleId) {
    const bundle = await db.bundle.findUnique({ where: { id: input.bundleId } });
    if (!bundle || bundle.ownerId !== user.id) return fail("That bundle doesn't exist.");
    expiresAt = bundleExpiry(bundle.moveOutDate);
  }

  const files = filesFrom(formData, "photos");
  if (files.length > MAX_PHOTOS) return fail(`Add at most ${MAX_PHOTOS} photos.`);

  if (!(await rateLimit(`listing:${user.id}`, LIMITS.listingsPerDay.limit, LIMITS.listingsPerDay.windowMs))) {
    return fail(`You can post up to ${LIMITS.listingsPerDay.limit} listings a day. Try again tomorrow, or use a move-out bundle.`);
  }

  let keys: string[];
  try {
    keys = await saveAll(files);
  } catch (err) {
    if (err instanceof UploadError) return fail(err.message, { photos: err.message });
    throw err;
  }

  const listing = await db.listing.create({
    data: {
      ...input,
      ownerId: user.id,
      expiresAt,
      photos: { create: keys.map((key, position) => ({ key, position })) },
    },
  });
  await notifyMatchingAlerts(listing);
  revalidatePath("/");
  redirect(`/listings/${listing.id}?posted=1`);
}

export async function updateListing(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser();
  const listing = await ownedListing(String(formData.get("listingId")), user.id);
  if (!listing) return fail("Listing not found.");

  // The kind can't change after posting; requests and bookings depend on it.
  formData.set("kind", listing.kind);
  const parsed = parseListingForm(formData);
  if ("fieldErrors" in parsed) return fail("Please fix the highlighted fields.", parsed.fieldErrors);
  const { bundleId, ...input } = parsed.data;

  let expiresAt: Date | undefined;
  if (bundleId !== listing.bundleId) {
    if (bundleId) {
      const bundle = await db.bundle.findUnique({ where: { id: bundleId } });
      if (!bundle || bundle.ownerId !== user.id) return fail("That bundle doesn't exist.");
      expiresAt = bundleExpiry(bundle.moveOutDate);
    }
  }

  const removeIds = formData.getAll("removePhoto").map(String);
  const existing = await db.listingPhoto.findMany({
    where: { listingId: listing.id },
    orderBy: { position: "asc" },
  });
  const removing = existing.filter((p) => removeIds.includes(p.id));
  const keeping = existing.filter((p) => !removeIds.includes(p.id));
  const files = filesFrom(formData, "photos");
  if (keeping.length + files.length > MAX_PHOTOS) {
    return fail(`A listing can have at most ${MAX_PHOTOS} photos.`);
  }

  let keys: string[];
  try {
    keys = await saveAll(files);
  } catch (err) {
    if (err instanceof UploadError) return fail(err.message, { photos: err.message });
    throw err;
  }

  await db.$transaction([
    db.listingPhoto.deleteMany({ where: { id: { in: removing.map((p) => p.id) } } }),
    db.listing.update({
      where: { id: listing.id },
      data: {
        ...input,
        bundleId,
        ...(expiresAt ? { expiresAt } : {}),
        photos: {
          create: keys.map((key, i) => ({ key, position: keeping.length + i })),
        },
      },
    }),
  ]);
  await deleteImages(removing.map((p) => p.key));
  revalidatePath(`/listings/${listing.id}`);
  redirect(`/listings/${listing.id}`);
}

export async function deleteListing(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser();
  const listing = await ownedListing(String(formData.get("listingId")), user.id);
  if (!listing) return fail("Listing not found.");
  const [photos, affected] = await Promise.all([
    db.listingPhoto.findMany({ where: { listingId: listing.id } }),
    db.listingRequest.findMany({
      where: { listingId: listing.id, status: { in: ["PENDING", "ACCEPTED"] } },
    }),
  ]);
  await db.listing.delete({ where: { id: listing.id } });
  await deleteImages(photos.map((p) => p.key));
  await Promise.all(
    affected.map((r) =>
      notify({
        userId: r.requesterId,
        type: "request_cancelled",
        title: `"${listing.title}" was taken down`,
        body: "The owner deleted this listing, so your request was cancelled.",
        link: "/my/requests",
      }),
    ),
  );
  revalidatePath("/");
  redirect("/my/listings?deleted=1");
}

const OWNER_STATUSES: ListingStatus[] = ["ACTIVE", "RESERVED", "SOLD", "UNAVAILABLE"];

export async function setListingStatus(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser();
  const listing = await ownedListing(String(formData.get("listingId")), user.id);
  if (!listing) return fail("Listing not found.");
  const status = String(formData.get("status")) as ListingStatus;
  if (!OWNER_STATUSES.includes(status)) return fail("Invalid status.");
  if (listing.status === "REMOVED") return fail("This listing was removed by a moderator.");

  const acceptedSale = await db.listingRequest.findFirst({
    where: { listingId: listing.id, status: "ACCEPTED", startDate: null },
  });

  if (status === "SOLD") {
    const pending = await db.listingRequest.findMany({
      where: { listingId: listing.id, status: "PENDING", startDate: null },
    });
    await db.$transaction([
      db.listing.update({ where: { id: listing.id }, data: { status } }),
      ...(acceptedSale
        ? [db.listingRequest.update({ where: { id: acceptedSale.id }, data: { status: "COMPLETED" } })]
        : []),
      db.listingRequest.updateMany({
        where: { id: { in: pending.map((r) => r.id) } },
        data: { status: "DECLINED", respondedAt: new Date() },
      }),
    ]);
    if (acceptedSale) {
      await notify({
        userId: acceptedSale.requesterId,
        type: "sale_completed",
        title: `You bought "${listing.title}"`,
        body: "The seller marked it as sold to you. Leave them a review!",
        link: "/my/requests",
      });
    }
    await Promise.all(
      pending.map((r) =>
        notify({
          userId: r.requesterId,
          type: "request_declined",
          title: `"${listing.title}" has sold`,
          body: "Sorry, this item sold to someone else.",
          link: "/my/requests",
        }),
      ),
    );
  } else {
    // Moving off RESERVED releases whoever it was reserved for.
    const release = acceptedSale && status !== "RESERVED";
    await db.$transaction([
      db.listing.update({ where: { id: listing.id }, data: { status } }),
      ...(release
        ? [db.listingRequest.update({ where: { id: acceptedSale.id }, data: { status: "CANCELLED" } })]
        : []),
    ]);
    if (release) {
      await notify({
        userId: acceptedSale.requesterId,
        type: "request_cancelled",
        title: `Reservation released: "${listing.title}"`,
        body: "The seller released your reservation on this item.",
        link: `/listings/${listing.id}`,
      });
    }
  }
  revalidatePath(`/listings/${listing.id}`);
  revalidatePath("/my/listings");
  return ok("Status updated.");
}

export async function renewListing(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser();
  const listing = await ownedListing(String(formData.get("listingId")), user.id);
  if (!listing) return fail("Listing not found.");
  if (listing.status === "REMOVED") return fail("This listing was removed by a moderator.");
  await db.listing.update({
    where: { id: listing.id },
    data: { expiresAt: defaultExpiry(), expiryWarnedAt: null },
  });
  revalidatePath("/my/listings");
  revalidatePath(`/listings/${listing.id}`);
  return ok("Renewed for another 30 days.");
}

// ─── Move-out bundles ────────────────────────────────────────────────────────

const MAX_BUNDLE_ITEMS = 30;

const bundleItemSchema = z.object({
  title: z.string().trim().min(3, "Title needs 3+ characters.").max(80),
  category: z.enum(Category, "Pick a category."),
  condition: z.enum(Condition, "Pick a condition."),
  price: z.string().refine((v) => dollarsToCents(v) !== null, "Enter a price."),
  description: z.string().trim().max(2000).default(""),
});

export async function createBundle(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser();
  const errors: Record<string, string> = {};

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim().slice(0, 2000);
  const neighbourhood = String(formData.get("neighbourhood") ?? "");
  const moveOutDate = parseDateInput(String(formData.get("moveOutDate") ?? ""));
  if (title.length < 3 || title.length > 80) errors.title = "Give your bundle a title (3–80 characters).";
  if (!(NEIGHBOURHOODS as readonly string[]).includes(neighbourhood)) errors.neighbourhood = "Pick a pickup area.";
  if (!moveOutDate) errors.moveOutDate = "When are you moving out?";
  else if (moveOutDate < todayDate()) errors.moveOutDate = "Move-out date can't be in the past.";

  const indexes = [...new Set(
    [...formData.keys()]
      .map((k) => /^items\.(\d+)\./.exec(k)?.[1])
      .filter((v): v is string => v !== undefined),
  )].sort((a, b) => Number(a) - Number(b));
  if (indexes.length === 0) errors.items = "Add at least one item.";
  if (indexes.length > MAX_BUNDLE_ITEMS) errors.items = `A bundle can have at most ${MAX_BUNDLE_ITEMS} items.`;

  const items: (z.infer<typeof bundleItemSchema> & { files: File[] })[] = [];
  for (const i of indexes) {
    const parsed = bundleItemSchema.safeParse({
      title: formData.get(`items.${i}.title`),
      category: formData.get(`items.${i}.category`),
      condition: formData.get(`items.${i}.condition`),
      price: formData.get(`items.${i}.price`) ?? "",
      description: formData.get(`items.${i}.description`) ?? "",
    });
    const files = filesFrom(formData, `items.${i}.photos`);
    if (!parsed.success) {
      for (const [field, msg] of Object.entries(fieldErrorsFrom(parsed.error.issues))) {
        errors[`items.${i}.${field}`] = msg;
      }
    } else if (files.length > MAX_PHOTOS) {
      errors[`items.${i}.photos`] = `At most ${MAX_PHOTOS} photos per item.`;
    } else {
      items.push({ ...parsed.data, files });
    }
  }
  if (Object.keys(errors).length) return fail("Please fix the highlighted fields.", errors);

  if (!(await rateLimit(`bundle:${user.id}`, 3, 24 * 60 * 60 * 1000))) {
    return fail("You can create up to 3 bundles a day.");
  }

  const saved: string[][] = [];
  try {
    for (const item of items) saved.push(await saveAll(item.files));
  } catch (err) {
    await deleteImages(saved.flat());
    if (err instanceof UploadError) return fail(err.message);
    throw err;
  }

  const expiresAt = bundleExpiry(moveOutDate!);
  const bundle = await db.bundle.create({
    data: {
      ownerId: user.id,
      title,
      description,
      moveOutDate: moveOutDate!,
      neighbourhood,
      listings: {
        create: items.map((item, i) => ({
          ownerId: user.id,
          kind: "SALE" as const,
          title: item.title,
          description: item.description,
          category: item.category,
          condition: item.condition,
          priceCents: dollarsToCents(item.price)!,
          neighbourhood,
          expiresAt,
          photos: { create: saved[i].map((key, position) => ({ key, position })) },
        })),
      },
    },
    include: { listings: true },
  });
  for (const listing of bundle.listings) await notifyMatchingAlerts(listing);
  revalidatePath("/");
  redirect(`/bundles/${bundle.id}?posted=1`);
}

export async function updateBundleMoveOut(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser();
  const bundle = await db.bundle.findUnique({ where: { id: String(formData.get("bundleId")) } });
  if (!bundle || bundle.ownerId !== user.id) return fail("Bundle not found.");
  const moveOutDate = parseDateInput(String(formData.get("moveOutDate") ?? ""));
  if (!moveOutDate || moveOutDate < todayDate()) return fail("Pick a move-out date that's today or later.");
  await db.$transaction([
    db.bundle.update({ where: { id: bundle.id }, data: { moveOutDate } }),
    db.listing.updateMany({
      where: { bundleId: bundle.id },
      data: { expiresAt: bundleExpiry(moveOutDate), expiryWarnedAt: null },
    }),
  ]);
  revalidatePath(`/bundles/${bundle.id}`);
  return ok("Move-out date updated.");
}

export async function deleteBundle(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser();
  const bundle = await db.bundle.findUnique({ where: { id: String(formData.get("bundleId")) } });
  if (!bundle || bundle.ownerId !== user.id) return fail("Bundle not found.");
  // Keeps the items as standalone listings; delete those individually if wanted.
  await db.$transaction([
    db.listing.updateMany({
      where: { bundleId: bundle.id },
      data: { expiresAt: defaultExpiry() },
    }),
    db.bundle.delete({ where: { id: bundle.id } }),
  ]);
  revalidatePath("/my/listings");
  redirect("/my/listings");
}
