import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, ListingGrid } from "@/components/listing-card";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { listingCardSelect, publicListingWhere } from "@/lib/listings";

export const metadata: Metadata = { title: "Saved" };

export default async function SavedPage() {
  const user = await requireUser("/my/saved");
  const favorites = await db.favorite.findMany({
    where: { userId: user.id, listing: publicListingWhere() },
    orderBy: { createdAt: "desc" },
    select: { listing: { select: listingCardSelect } },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Saved listings</h1>
      {favorites.length ? (
        <ListingGrid listings={favorites.map((f) => f.listing)} />
      ) : (
        <EmptyState title="No saved listings">
          Tap ♡ Save on anything you like to keep track of it here. Want to hear about new posts
          instead? <Link href="/alerts" className="link">Set up an alert</Link>.
        </EmptyState>
      )}
    </div>
  );
}
