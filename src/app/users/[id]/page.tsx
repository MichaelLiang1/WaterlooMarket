import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState, ListingGrid } from "@/components/listing-card";
import { ReportForm } from "@/components/report-form";
import { Stars } from "@/components/stars";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDay, timeAgo } from "@/lib/format";
import { listingCardSelect, publicListingWhere, userRating } from "@/lib/listings";

export const metadata: Metadata = { title: "Profile" };

export default async function UserPage(props: PageProps<"/users/[id]">) {
  const { id } = await props.params;
  const [profile, viewer] = await Promise.all([
    db.user.findUnique({
      where: { id },
      select: { id: true, name: true, program: true, year: true, createdAt: true, bannedAt: true },
    }),
    getCurrentUser(),
  ]);
  if (!profile || (profile.bannedAt && viewer?.role !== "ADMIN")) notFound();

  const [rating, reviews, listings, completed] = await Promise.all([
    userRating(profile.id),
    db.review.findMany({
      where: { revieweeId: profile.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { reviewer: { select: { name: true } }, request: { select: { listing: { select: { title: true } } } } },
    }),
    db.listing.findMany({
      where: { ownerId: profile.id, ...publicListingWhere() },
      orderBy: { createdAt: "desc" },
      select: listingCardSelect,
      take: 24,
    }),
    db.listingRequest.count({
      where: { status: "COMPLETED", OR: [{ requesterId: profile.id }, { listing: { ownerId: profile.id } }] },
    }),
  ]);

  return (
    <div className="space-y-6">
      <section className="card flex flex-wrap items-center gap-4 p-5">
        <span className="grid size-16 place-items-center rounded-full bg-gold-300 text-2xl font-bold">
          {profile.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold">{profile.name}</h1>
          <p className="text-sm text-stone-600">
            {[profile.program, profile.year && `Year ${profile.year}`].filter(Boolean).join(" · ")}
          </p>
          <p className="text-xs text-stone-500">
            Member since {formatDay(profile.createdAt)} · {completed} completed transaction{completed === 1 ? "" : "s"}
          </p>
          {rating.count > 0 ? <Stars value={rating.average ?? 0} count={rating.count} /> : <p className="text-xs text-stone-500">No reviews yet</p>}
          {profile.bannedAt && <p className="mt-1 text-sm font-semibold text-red-700">Banned</p>}
        </div>
        {viewer?.emailVerifiedAt && viewer.id !== profile.id && <ReportForm userId={profile.id} label="Report user" />}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Listings</h2>
        {listings.length ? <ListingGrid listings={listings} /> : <EmptyState title="No active listings" />}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Reviews</h2>
        {reviews.length === 0 ? (
          <EmptyState title="No reviews yet" />
        ) : (
          <ul className="card divide-y divide-stone-100">
            {reviews.map((r) => (
              <li key={r.id} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <Stars value={r.rating} />
                  <span className="text-xs text-stone-400">{timeAgo(r.createdAt)}</span>
                </div>
                {r.comment && <p className="mt-1 text-sm">{r.comment}</p>}
                <p className="mt-1 text-xs text-stone-500">
                  {r.reviewer.name} · {r.request.listing.title}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
