import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/listing-card";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser("/notifications");
  const notifications = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unread = notifications.some((n) => !n.readAt);
  // Viewing the page counts as reading; this render still highlights what was new.
  if (unread) {
    await db.notification.updateMany({
      where: { userId: user.id, readAt: null, id: { in: notifications.map((n) => n.id) } },
      data: { readAt: new Date() },
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <Link href="/alerts" className="link text-sm">
          Manage search alerts
        </Link>
      </div>
      {notifications.length === 0 ? (
        <EmptyState title="You're all caught up">
          Request updates, alert matches, and reminders will show up here.
        </EmptyState>
      ) : (
        <ul className="card divide-y divide-stone-100">
          {notifications.map((n) => {
            const body = (
              <div className="flex gap-3 p-4">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-gold-500"}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${n.readAt ? "" : "font-semibold"}`}>{n.title}</p>
                  {n.body && <p className="mt-0.5 line-clamp-3 text-sm whitespace-pre-line text-stone-600">{n.body}</p>}
                  <p className="mt-1 text-xs text-stone-400">{timeAgo(n.createdAt)}</p>
                </div>
              </div>
            );
            return (
              <li key={n.id}>
                {n.link ? (
                  <Link href={n.link} className="block hover:bg-stone-50">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
