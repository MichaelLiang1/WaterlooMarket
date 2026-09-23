import type { Metadata } from "next";
import Link from "next/link";
import { ListingForm } from "@/components/listing-form";
import { ListingKind } from "@/generated/prisma/enums";
import { requireVerifiedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { todayDate } from "@/lib/format";
import { upcomingTerms } from "@/lib/terms";

export const metadata: Metadata = { title: "Post a listing" };

export default async function NewListingPage(props: PageProps<"/listings/new">) {
  const user = await requireVerifiedUser("/listings/new");
  const sp = await props.searchParams;
  const kindParam = typeof sp.kind === "string" ? sp.kind : "";
  const kind = kindParam in ListingKind ? (kindParam as ListingKind) : "SALE";
  const bundles = await db.bundle.findMany({
    where: { ownerId: user.id, moveOutDate: { gte: todayDate() } },
    select: { id: true, title: true },
    orderBy: { moveOutDate: "asc" },
  });
  const bundleParam = typeof sp.bundle === "string" ? sp.bundle : "";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-bold">Post a listing</h1>
        <Link href="/bundles/new" className="link text-sm">
          Leaving for co-op? List several items at once →
        </Link>
      </div>
      <ListingForm
        terms={upcomingTerms(new Date(), 4)}
        bundles={bundles}
        initial={{
          kind,
          title: "",
          description: "",
          category: "",
          condition: "",
          price: "",
          priceUnit: "FLAT",
          deposit: "",
          neighbourhood: "",
          availableFrom: "",
          availableUntil: "",
          city: "",
          externalUrl: "",
          bundleId: bundles.some((b) => b.id === bundleParam) ? bundleParam : "",
          photos: [],
        }}
      />
    </div>
  );
}
