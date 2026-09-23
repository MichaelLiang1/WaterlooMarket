"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, type ActionState } from "@/lib/action-state";
import { requireVerifiedUser, type CurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { appUrl, sendEmail } from "@/lib/email";
import { publicListingWhere } from "@/lib/listings";
import { LIMITS, rateLimit } from "@/lib/rate-limit";

const MAX_LENGTH = 2000;

function readBody(formData: FormData) {
  return String(formData.get("body") ?? "").trim().slice(0, MAX_LENGTH);
}

async function deliver(conversationId: string, sender: CurrentUser, body: string) {
  const convo = await db.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: { listing: { select: { title: true } }, buyer: true, seller: true },
  });
  const recipient = convo.buyerId === sender.id ? convo.seller : convo.buyer;

  // Only email for the first unread message in a burst, not every line.
  const alreadyUnread = await db.message.count({
    where: { conversationId, senderId: sender.id, readAt: null },
  });

  await db.$transaction([
    db.message.create({ data: { conversationId, senderId: sender.id, body } }),
    db.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } }),
  ]);

  if (alreadyUnread === 0 && recipient.emailNotifications && !recipient.bannedAt) {
    await sendEmail({
      to: recipient.email,
      subject: `New message from ${sender.name} about "${convo.listing.title}"`,
      text: `${sender.name} wrote:\n\n${body}\n\nReply: ${appUrl(`/messages/${conversationId}`)}\n\n—\nWaterloo Market · Turn off email notifications at ${appUrl("/account")}`,
    });
  }
}

async function checkRate(userId: string) {
  return rateLimit(`msg:${userId}`, LIMITS.messagesPerMinute.limit, LIMITS.messagesPerMinute.windowMs);
}

/** Opens (or reuses) the buyer↔owner thread for a listing and sends the first message. */
export async function startConversation(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser();
  const body = readBody(formData);
  if (!body) return fail("Write a message first.");
  const listing = await db.listing.findFirst({
    where: { id: String(formData.get("listingId")), ...publicListingWhere() },
  });
  if (!listing) return fail("This listing is no longer available.");
  if (listing.ownerId === user.id) return fail("This is your own listing.");
  if (!(await checkRate(user.id))) return fail("Slow down a little — try again in a minute.");

  const convo = await db.conversation.upsert({
    where: { listingId_buyerId: { listingId: listing.id, buyerId: user.id } },
    update: {},
    create: { listingId: listing.id, buyerId: user.id, sellerId: listing.ownerId },
  });
  await deliver(convo.id, user, body);
  redirect(`/messages/${convo.id}`);
}

export async function sendMessage(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireVerifiedUser();
  const body = readBody(formData);
  if (!body) return fail("Write a message first.");
  const convo = await db.conversation.findUnique({
    where: { id: String(formData.get("conversationId")) },
  });
  if (!convo || (convo.buyerId !== user.id && convo.sellerId !== user.id)) {
    return fail("Conversation not found.");
  }
  if (!(await checkRate(user.id))) return fail("Slow down a little — try again in a minute.");
  await deliver(convo.id, user, body);
  revalidatePath(`/messages/${convo.id}`);
  return { success: "sent" };
}
