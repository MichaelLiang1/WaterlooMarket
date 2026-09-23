import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteBundle, updateBundleMoveOut } from "@/app/actions/listings";
import { ActionForm, SubmitButton } from "@/components/forms";
import { EmptyState, ListingGrid } from "@/components/listing-card";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDay, toDateInput, todayDate } from "@/lib/format";
import { listingCardSelect, publicListingWhere } from "@/lib/listings";

export async function generateMetadata(props: PageProps<"/bundles/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const bundle = await db.bundle.findUnique({ where: { id }, select: { title: true } });
  return { title: bundle?.title ?? "Bundle" };
}

export default async function BundlePage(props: PageProps<"/bundles/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const [bundle, user] = await Promise.all([
    db.bundle.findUnique({
      where: { id },
      include: { owner: { select: { id: true, name: true, bannedAt: true } } },
    }),
    getCurrentUser(),
  ]);
  if (!bundle) notFound();
  const isOwner = user?.id === bundle.ownerId;
  if (bundle.owner.bannedAt && !isOwner && user?.role !== "ADMIN") notFound();

  const listings = await db.listing.findMany({
    where: isOwner ? { bundleId: bundle.id, status: { not: "REMOVED" } } : { bundleId: bundle.id, ...publicListingWhere() },
    select: listingCardSelect,
    orderBy: { createdAt: "asc" },
  });

  const today = todayDate();
  const daysLeft = Math.round((bundle.moveOutDate.getTime() - today.getTime()) / 86_400_000);

  return (
    <div className="space-y-5">
      {sp.posted && (
        <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
          Your bundle is live — {listings.length} items posted.
        </p>
      )}
      <section className="rounded-2xl bg-ink p-5 text-white sm:p-8">
        <p className="text-sm font-medium text-gold-400">
          {daysLeft > 1 ? `${daysLeft} days left` : daysLeft === 1 ? "Last day tomorrow" : daysLeft === 0 ? "Moving out today" : "Moved out"} · Gone by {formatDay(bundle.moveOutDate)}
        </p>
        <h1 className="mt-1 text-2xl font-bold">{bundle.title}</h1>
        <p className="mt-1 text-sm text-stone-300">
          by <Link href={`/users/${bundle.owner.id}`} className="underline">{bundle.owner.name}</Link> · Pickup: {bundle.neighbourhood}
        </p>
        {bundle.description && <p className="mt-3 max-w-2xl text-sm whitespace-pre-line text-stone-200">{bundle.description}</p>}
      </section>

      {isOwner && (
        <div className="card flex flex-wrap items-end gap-3 p-4">
          <ActionForm action={updateBundleMoveOut} className="flex items-end gap-2">
            <input type="hidden" name="bundleId" value={bundle.id} />
            <div>
              <label className="label" htmlFor="moveOutDate">Move-out date</label>
              <input id="moveOutDate" name="moveOutDate" type="date" defaultValue={toDateInput(bundle.moveOutDate)} min={toDateInput(today)} className="input" />
            </div>
            <SubmitButton className="btn-secondary">Update</SubmitButton>
          </ActionForm>
          <Link href={`/listings/new?bundle=${bundle.id}`} className="btn-secondary">
            + Add item
          </Link>
          <ActionForm action={deleteBundle} confirm="Ungroup this bundle? The items stay listed individually for 30 days.">
            <input type="hidden" name="bundleId" value={bundle.id} />
            <SubmitButton className="btn-danger">Ungroup bundle</SubmitButton>
          </ActionForm>
        </div>
      )}

      {listings.length ? (
        <ListingGrid listings={listings} />
      ) : (
        <EmptyState title="Everything's gone!">All items in this bundle have sold or been taken down.</EmptyState>
      )}
    </div>
  );
}
