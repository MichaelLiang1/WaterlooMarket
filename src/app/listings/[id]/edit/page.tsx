import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingForm } from "@/components/listing-form";
import { requireVerifiedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { toDateInput, todayDate } from "@/lib/format";
import { upcomingTerms } from "@/lib/terms";
import { imageUrl } from "@/lib/image-url";

export const metadata: Metadata = { title: "Edit listing" };

const dollars = (cents: number | null) => (cents == null ? "" : String(cents / 100));

export default async function EditListingPage(props: PageProps<"/listings/[id]/edit">) {
  const { id } = await props.params;
  const user = await requireVerifiedUser(`/listings/${id}/edit`);
  const listing = await db.listing.findUnique({
    where: { id },
    include: { photos: { orderBy: { position: "asc" } } },
  });
  if (!listing || listing.ownerId !== user.id) notFound();

  const bundles = await db.bundle.findMany({
    where: {
      ownerId: user.id,
      OR: [{ moveOutDate: { gte: todayDate() } }, { id: listing.bundleId ?? "" }],
    },
    select: { id: true, title: true },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Edit listing</h1>
      <ListingForm
        terms={upcomingTerms(new Date(), 4)}
        bundles={bundles}
        initial={{
          id: listing.id,
          kind: listing.kind,
          title: listing.title,
          description: listing.description,
          category: listing.category,
          condition: listing.condition ?? "",
          price: dollars(listing.priceCents),
          priceUnit: listing.priceUnit,
          deposit: dollars(listing.depositCents),
          neighbourhood: listing.neighbourhood,
          availableFrom: toDateInput(listing.availableFrom),
          availableUntil: toDateInput(listing.availableUntil),
          city: listing.city ?? "",
          externalUrl: listing.externalUrl ?? "",
          bundleId: listing.bundleId ?? "",
          photos: listing.photos.map((p) => ({ id: p.id, url: imageUrl(p.key) })),
        }}
      />
    </div>
  );
}
