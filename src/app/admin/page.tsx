import type { Metadata } from "next";
import Link from "next/link";
import { banUser, removeListing, resolveReport, unbanUser } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDay, hoursAgo, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage(props: PageProps<"/admin">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const userId = typeof sp.user === "string" ? sp.user : "";

  const [reports, users, stats] = await Promise.all([
    db.report.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "asc" },
      take: 50,
      include: {
        reporter: { select: { id: true, name: true } },
        reportedUser: { select: { id: true, name: true, email: true, bannedAt: true } },
        listing: { select: { id: true, title: true, status: true } },
      },
    }),
    q || userId
      ? db.user.findMany({
          where: userId
            ? { id: userId }
            : { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] },
          take: 20,
          include: { _count: { select: { listings: true, reportsAgainst: true } } },
        })
      : Promise.resolve([]),
    Promise.all([
      db.user.count(),
      db.listing.count({ where: { status: "ACTIVE", expiresAt: { gt: new Date() } } }),
      db.listing.count({ where: { createdAt: { gte: hoursAgo(24) } } }),
      db.report.count({ where: { status: "OPEN" } }),
    ]),
  ]);
  const [userCount, activeListings, newListings, openReports] = stats;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Users", userCount],
          ["Active listings", activeListings],
          ["Posted in 24h", newListings],
          ["Open reports", openReports],
        ].map(([label, value]) => (
          <div key={label} className="card p-4">
            <p className="text-xs text-stone-500">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-2 font-semibold">Users</h2>
        <form className="mb-3 flex gap-2" action="/admin">
          <input name="q" defaultValue={q} placeholder="Search by name or email" className="input max-w-sm" />
          <button className="btn-secondary">Search</button>
        </form>
        {users.length > 0 && (
          <ul className="card divide-y divide-stone-100">
            {users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/users/${u.id}`} className="font-medium hover:underline">
                    {u.name}
                  </Link>{" "}
                  {u.role === "ADMIN" && <span className="chip bg-ink text-white">Admin</span>}
                  {u.bannedAt && <span className="chip bg-red-100 text-red-800">Banned {formatDay(u.bannedAt)}</span>}
                  <p className="text-xs text-stone-500">
                    {u.email} · {u.emailVerifiedAt ? "verified" : "unverified"} · {u._count.listings} listings ·{" "}
                    {u._count.reportsAgainst} reports
                  </p>
                </div>
                {u.bannedAt ? (
                  <ActionForm action={unbanUser}>
                    <input type="hidden" name="userId" value={u.id} />
                    <SubmitButton className="btn-secondary btn-sm">Unban</SubmitButton>
                  </ActionForm>
                ) : (
                  u.role !== "ADMIN" && (
                    <ActionForm action={banUser} className="flex gap-2" confirm={`Ban ${u.name}? Their listings will be hidden.`}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input name="reason" placeholder="Reason" className="input w-40" />
                      <SubmitButton className="btn-danger btn-sm">Ban</SubmitButton>
                    </ActionForm>
                  )
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Open reports</h2>
        {reports.length === 0 ? (
          <p className="text-sm text-stone-600">No open reports. 🎉</p>
        ) : (
          <ul className="space-y-3">
            {reports.map((r) => (
              <li key={r.id} className="card space-y-2 p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="font-medium">{r.reason}</p>
                  <span className="text-xs text-stone-500">
                    by {r.reporter.name} · {timeAgo(r.createdAt)}
                  </span>
                </div>
                {r.details && <p className="text-sm text-stone-700">{r.details}</p>}
                <p className="text-sm">
                  {r.listing && (
                    <>
                      Listing: <Link href={`/listings/${r.listing.id}`} className="link">{r.listing.title}</Link> ({r.listing.status.toLowerCase()})
                      <br />
                    </>
                  )}
                  {r.reportedUser && (
                    <>
                      User: <Link href={`/admin?user=${r.reportedUser.id}`} className="link">{r.reportedUser.name}</Link> ({r.reportedUser.email})
                      {r.reportedUser.bannedAt && " — banned"}
                    </>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  {r.listing && r.listing.status !== "REMOVED" && (
                    <ActionForm action={removeListing} confirm="Remove this listing?">
                      <input type="hidden" name="listingId" value={r.listing.id} />
                      <input type="hidden" name="reason" value={r.reason} />
                      <SubmitButton className="btn-danger btn-sm">Remove listing</SubmitButton>
                    </ActionForm>
                  )}
                  {r.reportedUser && !r.reportedUser.bannedAt && (
                    <ActionForm action={banUser} confirm={`Ban ${r.reportedUser.name}?`}>
                      <input type="hidden" name="userId" value={r.reportedUser.id} />
                      <input type="hidden" name="reason" value={r.reason} />
                      <SubmitButton className="btn-danger btn-sm">Ban user</SubmitButton>
                    </ActionForm>
                  )}
                  <ActionForm action={resolveReport}>
                    <input type="hidden" name="reportId" value={r.id} />
                    <input type="hidden" name="status" value="RESOLVED" />
                    <SubmitButton className="btn-secondary btn-sm">Mark resolved</SubmitButton>
                  </ActionForm>
                  <ActionForm action={resolveReport}>
                    <input type="hidden" name="reportId" value={r.id} />
                    <input type="hidden" name="status" value="DISMISSED" />
                    <SubmitButton className="btn-secondary btn-sm">Dismiss</SubmitButton>
                  </ActionForm>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
