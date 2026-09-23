"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";

function revalidateAdmin() {
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function removeListing(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const listing = await db.listing.findUnique({ where: { id: String(formData.get("listingId")) } });
  if (!listing) return fail("Listing not found.");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300);
  await db.$transaction([
    db.listing.update({ where: { id: listing.id }, data: { status: "REMOVED" } }),
    db.listingRequest.updateMany({
      where: { listingId: listing.id, status: "PENDING" },
      data: { status: "DECLINED", respondedAt: new Date() },
    }),
    db.report.updateMany({
      where: { listingId: listing.id, status: "OPEN" },
      data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: admin.id },
    }),
  ]);
  await notify({
    userId: listing.ownerId,
    type: "listing_removed",
    title: `Your listing "${listing.title}" was removed`,
    body: `A moderator removed this listing for breaking the marketplace rules.${reason ? `\nReason: ${reason}` : ""}`,
    link: "/my/listings",
  });
  revalidateAdmin();
  revalidatePath(`/listings/${listing.id}`);
  return ok("Listing removed.");
}

export async function restoreListing(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const { count } = await db.listing.updateMany({
    where: { id: String(formData.get("listingId")), status: "REMOVED" },
    data: { status: "ACTIVE" },
  });
  if (!count) return fail("Listing not found or not removed.");
  revalidateAdmin();
  return ok("Listing restored.");
}

export async function banUser(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId"));
  if (userId === admin.id) return fail("You can't ban yourself.");
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return fail("User not found.");
  if (user.role === "ADMIN") return fail("Remove admin rights before banning an admin.");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300) || null;
  // Banned users' listings drop out of the feed via publicListingWhere().
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { bannedAt: new Date(), banReason: reason } }),
    db.session.deleteMany({ where: { userId } }),
    db.listingRequest.updateMany({
      where: { requesterId: userId, status: "PENDING" },
      data: { status: "CANCELLED" },
    }),
    db.report.updateMany({
      where: { reportedUserId: userId, status: "OPEN" },
      data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: admin.id },
    }),
  ]);
  revalidateAdmin();
  return ok(`${user.name} has been banned.`);
}

export async function unbanUser(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  await db.user.update({
    where: { id: String(formData.get("userId")) },
    data: { bannedAt: null, banReason: null },
  });
  revalidateAdmin();
  return ok("User unbanned.");
}

export async function resolveReport(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const status = formData.get("status") === "DISMISSED" ? "DISMISSED" : "RESOLVED";
  await db.report.update({
    where: { id: String(formData.get("reportId")) },
    data: { status, resolvedAt: new Date(), resolvedById: admin.id },
  });
  revalidateAdmin();
  return ok(status === "DISMISSED" ? "Report dismissed." : "Report resolved.");
}
