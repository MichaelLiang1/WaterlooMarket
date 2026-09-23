import type { Metadata } from "next";
import Link from "next/link";
import { renewListing, setListingStatus } from "@/app/actions/listings";
import { ActionForm, SubmitButton } from "@/components/forms";
import { EmptyState, KindBadge, StatusBadge } from "@/components/listing-card";
import { requireVerifiedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDay, formatPrice, todayDate } from "@/lib/format";
import { imageUrl } from "@/lib/image-url";

export const metadata: Metadata = { title: "My listings" };

const SOON_MS = 7 * 24 * 60 * 60 * 1000;

export default async function MyListingsPage(props: PageProps<"/my/listings">) {
  const user = await requireVerifiedUser("/my/listings");
  const sp = await props.searchParams;
  const [listings, bundles] = await Promise.all([
    db.listing.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        photos: { take: 1, orderBy: { position: "asc" } },
        _count: { select: { requests: { where: { status: "PENDING" } } } },
      },
    }),
    db.bundle.findMany({
      where: { ownerId: user.id, moveOutDate: { gte: todayDate() } },
      orderBy: { moveOutDate: "asc" },
      include: { _count: { select: { listings: true } } },
    }),
  ]);

  const now = Date.now();
  const live = listings.filter((l) => (l.status === "ACTIVE" || l.status === "RESERVED") && l.expiresAt.getTime() > now);
  const expired = listings.filter((l) => (l.status === "ACTIVE" || l.status === "RESERVED") && l.expiresAt.getTime() <= now);
  const closed = listings.filter((l) => l.status !== "ACTIVE" && l.status !== "RESERVED");

  const row = (l: (typeof listings)[number]) => {
    const expiresSoon = l.expiresAt.getTime() - now < SOON_MS;
    return (
      <li key={l.id} className="flex items-center gap-3 p-3">
        <Link href={`/listings/${l.id}`} className="size-14 shrink-0 overflow-hidden rounded-lg bg-stone-100">
          {l.photos[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl(l.photos[0].key)} alt="" className="size-full object-cover" />
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/listings/${l.id}`} className="line-clamp-1 font-medium hover:underline">
            {l.title}
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
            <KindBadge kind={l.kind} />
            <StatusBadge status={l.status} />
            <span>{formatPrice(l.priceCents, l.priceUnit)}</span>
            {(l.status === "ACTIVE" || l.status === "RESERVED") && (
              <span className={expiresSoon ? "font-medium text-red-700" : ""}>
                · {l.expiresAt.getTime() <= now ? "Expired" : "Expires"} {formatDay(l.expiresAt)}
              </span>
            )}
            {l._count.requests > 0 && (
              <Link href="/my/requests?tab=incoming" className="chip bg-gold-200 text-gold-700">
                {l._count.requests} pending
              </Link>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
          {(l.status === "ACTIVE" || l.status === "RESERVED") && expiresSoon && (
            <ActionForm action={renewListing} showSuccess={false}>
              <input type="hidden" name="listingId" value={l.id} />
              <SubmitButton className="btn-gold btn-sm">Renew</SubmitButton>
            </ActionForm>
          )}
          {l.kind === "SALE" && (l.status === "ACTIVE" || l.status === "RESERVED") && (
            <ActionForm action={setListingStatus} showSuccess={false}>
              <input type="hidden" name="listingId" value={l.id} />
              <input type="hidden" name="status" value="SOLD" />
              <SubmitButton className="btn-secondary btn-sm">Sold</SubmitButton>
            </ActionForm>
          )}
          {(l.status === "SOLD" || l.status === "UNAVAILABLE") && (
            <ActionForm action={setListingStatus} showSuccess={false}>
              <input type="hidden" name="listingId" value={l.id} />
              <input type="hidden" name="status" value="ACTIVE" />
              <SubmitButton className="btn-secondary btn-sm">Relist</SubmitButton>
            </ActionForm>
          )}
          <Link href={`/listings/${l.id}/edit`} className="btn-secondary btn-sm">
            Edit
          </Link>
        </div>
      </li>
    );
  };

  const section = (title: string, items: typeof listings) =>
    items.length ? (
      <section>
        <h2 className="mb-2 font-semibold">
          {title} <span className="font-normal text-stone-500">({items.length})</span>
        </h2>
        <ul className="card divide-y divide-stone-100">
          {items.map(row)}
        </ul>
      </section>
    ) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">My listings</h1>
        <div className="flex gap-2">
          <Link href="/bundles/new" className="btn-secondary">📦 Move-out bundle</Link>
          <Link href="/listings/new" className="btn-gold">+ New listing</Link>
        </div>
      </div>
      {sp.deleted && <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">Listing deleted.</p>}

      {bundles.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Move-out bundles</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {bundles.map((b) => (
              <Link key={b.id} href={`/bundles/${b.id}`} className="card p-4 hover:shadow-md">
                <p className="font-medium">{b.title}</p>
                <p className="text-sm text-stone-600">
                  {b._count.listings} items · moving out {formatDay(b.moveOutDate)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {expired.length > 0 && (
        <p className="rounded-lg bg-gold-100 px-4 py-3 text-sm text-gold-700">
          {expired.length} listing{expired.length === 1 ? " has" : "s have"} expired and {expired.length === 1 ? "is" : "are"} hidden from the feed. Renew to bring {expired.length === 1 ? "it" : "them"} back.
        </p>
      )}
      {section("Needs renewal", expired)}
      {section("Live", live)}
      {section("Sold, unavailable & removed", closed)}

      {listings.length === 0 && (
        <EmptyState title="You haven't posted anything yet">
          <Link href="/listings/new" className="link">Post your first listing</Link> — it takes a minute.
        </EmptyState>
      )}
    </div>
  );
}
