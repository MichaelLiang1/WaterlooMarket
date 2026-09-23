import type { Metadata } from "next";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Me" };

/** Mobile hub for everything behind the desktop account menu. */
export default async function MePage() {
  const user = await requireUser("/me");
  const links = [
    ["/my/listings", "📋", "My listings"],
    ["/my/requests", "📅", "Requests & rentals"],
    ["/my/saved", "♡", "Saved"],
    ["/alerts", "🔔", "Search alerts"],
    ["/notifications", "📬", "Notifications"],
    ["/bundles/new", "📦", "Leaving for co-op? Bundle it"],
    [`/users/${user.id}`, "⭐", "Public profile & reviews"],
    ["/account", "⚙️", "Account settings"],
    ...(user.role === "ADMIN" ? [["/admin", "🛡️", "Admin panel"]] : []),
  ];
  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{user.name}</h1>
        <p className="text-sm text-stone-600">{user.email}</p>
      </div>
      <ul className="card divide-y divide-stone-100">
        {links.map(([href, icon, label]) => (
          <li key={href}>
            <Link href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50">
              <span className="w-6 text-center">{icon}</span>
              <span className="flex-1">{label}</span>
              <span className="text-stone-400">›</span>
            </Link>
          </li>
        ))}
      </ul>
      <form action={logout}>
        <button className="btn-secondary w-full">Log out</button>
      </form>
    </div>
  );
}
