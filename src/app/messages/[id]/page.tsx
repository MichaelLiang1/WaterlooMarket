import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageComposer } from "@/components/message-composer";
import { ReportForm } from "@/components/report-form";
import { requireVerifiedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime, formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Conversation" };

export default async function ConversationPage(props: PageProps<"/messages/[id]">) {
  const { id } = await props.params;
  const user = await requireVerifiedUser(`/messages/${id}`);
  const convo = await db.conversation.findUnique({
    where: { id },
    include: {
      listing: { select: { id: true, title: true, priceCents: true, priceUnit: true, status: true } },
      buyer: { select: { id: true, name: true } },
      seller: { select: { id: true, name: true } },
      messages: { orderBy: { createdAt: "asc" }, take: 500 },
    },
  });
  if (!convo || (convo.buyerId !== user.id && convo.sellerId !== user.id)) notFound();
  const other = convo.buyerId === user.id ? convo.seller : convo.buyer;

  await db.message.updateMany({
    where: { conversationId: convo.id, senderId: { not: user.id }, readAt: null },
    data: { readAt: new Date() },
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3">
      <div className="card flex items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          <p className="font-semibold">
            <Link href={`/users/${other.id}`} className="hover:underline">
              {other.name}
            </Link>
          </p>
          <Link href={`/listings/${convo.listing.id}`} className="block truncate text-sm text-stone-600 hover:underline">
            {convo.listing.title} · {formatPrice(convo.listing.priceCents, convo.listing.priceUnit)}
          </Link>
        </div>
        <Link href="/messages" className="btn-secondary btn-sm shrink-0">
          ← Inbox
        </Link>
      </div>

      <p className="text-center text-xs text-stone-500">
        Meet somewhere public on campus (SLC, DC, the library) and check items before paying.
      </p>

      <ol className="space-y-2">
        {convo.messages.map((m) => {
          const mine = m.senderId === user.id;
          return (
            <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "rounded-br-sm bg-ink text-white" : "rounded-bl-sm border border-stone-200 bg-white"}`}>
                <p className="whitespace-pre-line">{m.body}</p>
                <p className={`mt-0.5 text-[10px] ${mine ? "text-stone-400" : "text-stone-400"}`}>
                  {formatDateTime(m.createdAt)}
                  {mine && m.readAt && " · Read"}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <MessageComposer conversationId={convo.id} />
      <div className="flex justify-end">
        <ReportForm userId={other.id} label={`Report ${other.name}`} />
      </div>
    </div>
  );
}
