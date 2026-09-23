import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/listing-card";
import { requireVerifiedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/format";
import { imageUrl } from "@/lib/image-url";

export const metadata: Metadata = { title: "Messages" };

export default async function InboxPage() {
  const user = await requireVerifiedUser("/messages");
  const conversations = await db.conversation.findMany({
    where: { OR: [{ buyerId: user.id }, { sellerId: user.id }] },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: {
      listing: { select: { title: true, photos: { take: 1, orderBy: { position: "asc" }, select: { key: true } } } },
      buyer: { select: { name: true } },
      seller: { select: { name: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { messages: { where: { readAt: null, senderId: { not: user.id } } } } },
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Messages</h1>
      {conversations.length === 0 ? (
        <EmptyState title="No conversations yet">
          Message a seller from any listing page. You&apos;ll get an email when someone replies.
        </EmptyState>
      ) : (
        <ul className="card divide-y divide-stone-100">
          {conversations.map((c) => {
            const other = c.buyerId === user.id ? c.seller : c.buyer;
            const last = c.messages[0];
            const unread = c._count.messages;
            return (
              <li key={c.id}>
                <Link href={`/messages/${c.id}`} className="flex items-center gap-3 p-3 hover:bg-stone-50">
                  <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                    {c.listing.photos[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrl(c.listing.photos[0].key)} alt="" className="size-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2">
                      <p className={`truncate text-sm ${unread ? "font-bold" : "font-medium"}`}>{other.name}</p>
                      <span className="shrink-0 text-xs text-stone-400">{timeAgo(c.lastMessageAt)}</span>
                    </div>
                    <p className="truncate text-xs text-stone-500">{c.listing.title}</p>
                    {last && (
                      <p className={`truncate text-sm ${unread ? "text-stone-900" : "text-stone-500"}`}>
                        {last.senderId === user.id ? "You: " : ""}
                        {last.body}
                      </p>
                    )}
                  </div>
                  {unread > 0 && <span className="rounded-full bg-red-600 px-2 text-xs text-white">{unread}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
