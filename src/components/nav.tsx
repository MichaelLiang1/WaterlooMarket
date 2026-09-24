import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { getCurrentUser, manualApproval } from "@/lib/auth";
import { db } from "@/lib/db";

async function unreadCounts(userId: string) {
  const [messages, notifications] = await Promise.all([
    db.message.count({
      where: {
        readAt: null,
        senderId: { not: userId },
        conversation: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      },
    }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { messages, notifications };
}

function Badge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="absolute -top-1 -right-2 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] leading-4 font-bold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export async function Header() {
  const user = await getCurrentUser();
  const counts = user ? await unreadCounts(user.id) : { messages: 0, notifications: 0 };

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-stone-800 bg-ink text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2 font-bold tracking-tight">
            <span className="grid size-7 place-items-center rounded-md bg-gold-400 text-sm text-ink">W</span>
            <span className="hidden sm:inline">Waterloo Market</span>
          </Link>

          <form action="/" className="min-w-0 flex-1">
            <input
              name="q"
              type="search"
              placeholder="Search desks, bikes, mini fridges…"
              aria-label="Search listings"
              className="w-full rounded-lg border-0 bg-stone-800 px-3 py-1.5 text-white placeholder:text-stone-400 focus:ring-2 focus:ring-gold-400 focus:outline-none"
            />
          </form>

          <nav className="hidden items-center gap-5 text-sm md:flex">
            {user ? (
              <>
                <Link href="/listings/new" className="btn-gold btn-sm">
                  + Post
                </Link>
                <Link href="/my/listings" className="hover:text-gold-300">
                  My listings
                </Link>
                <Link href="/messages" className="relative hover:text-gold-300">
                  Messages
                  <Badge count={counts.messages} />
                </Link>
                <Link href="/notifications" className="relative hover:text-gold-300">
                  Notifications
                  <Badge count={counts.notifications} />
                </Link>
                <details className="relative">
                  <summary className="cursor-pointer list-none hover:text-gold-300">
                    {user.name.split(" ")[0]} ▾
                  </summary>
                  <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-lg border border-stone-200 bg-white py-1 text-stone-800 shadow-lg">
                    {[
                      ["/my/listings", "My listings"],
                      ["/my/requests", "My requests"],
                      ["/my/saved", "Saved"],
                      ["/alerts", "Search alerts"],
                      [`/users/${user.id}`, "Public profile"],
                      ["/account", "Account settings"],
                      ...(user.role === "ADMIN" ? [["/admin", "Admin panel"]] : []),
                    ].map(([href, label]) => (
                      <Link key={href} href={href} className="block px-4 py-2 hover:bg-stone-100">
                        {label}
                      </Link>
                    ))}
                    <form action={logout} className="border-t border-stone-100">
                      <button className="block w-full px-4 py-2 text-left hover:bg-stone-100">Log out</button>
                    </form>
                  </div>
                </details>
              </>
            ) : (
              <>
                <Link href="/login" className="hover:text-gold-300">
                  Log in
                </Link>
                <Link href="/signup" className="btn-gold btn-sm">
                  Sign up
                </Link>
              </>
            )}
          </nav>

          {!user && (
            <Link href="/login" className="text-sm md:hidden">
              Log in
            </Link>
          )}
          {user && (
            <Link href="/notifications" className="relative text-lg md:hidden" aria-label="Notifications">
              🔔
              <Badge count={counts.notifications} />
            </Link>
          )}
        </div>
        {user && !user.emailVerifiedAt && (
          <div className="bg-gold-300 px-4 py-2 text-center text-sm text-ink">
            {manualApproval() ? (
              "Your account is waiting for admin approval. You can browse until then."
            ) : (
              <>
                Confirm your school email to post and message.{" "}
                <Link href="/verify-email" className="font-semibold underline">
                  Resend link
                </Link>
              </>
            )}
          </div>
        )}
      </header>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] text-[11px] text-stone-600 md:hidden">
        {[
          { href: "/", icon: "🏠", label: "Browse" },
          { href: "/my/saved", icon: "♡", label: "Saved" },
          { href: "/listings/new", icon: "＋", label: "Post", primary: true },
          { href: "/messages", icon: "💬", label: "Messages", count: counts.messages },
          { href: user ? "/me" : "/login", icon: "👤", label: user ? "Me" : "Log in" },
        ].map((item) => (
          <Link key={item.label} href={item.href} className="flex flex-col items-center gap-0.5 py-2">
            <span
              className={`relative text-lg leading-none ${item.primary ? "grid size-8 place-items-center rounded-full bg-gold-400 text-ink" : ""}`}
            >
              {item.icon}
              {item.count ? <Badge count={item.count} /> : null}
            </span>
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
