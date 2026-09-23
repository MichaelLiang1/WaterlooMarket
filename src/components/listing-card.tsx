import Link from "next/link";
import type { ListingKind, ListingStatus } from "@/generated/prisma/enums";
import { CATEGORY_LABELS, CONDITION_LABELS, KIND_LABELS, STATUS_LABELS } from "@/lib/constants";
import { formatDay, formatPrice } from "@/lib/format";
import type { ListingCardData } from "@/lib/listings";
import { imageUrl } from "@/lib/image-url";

const KIND_STYLES: Record<ListingKind, string> = {
  SALE: "bg-emerald-100 text-emerald-800",
  RENT: "bg-sky-100 text-sky-800",
  STORAGE: "bg-violet-100 text-violet-800",
  WANTED: "bg-orange-100 text-orange-800",
  SUBLET: "bg-rose-100 text-rose-800",
};

const KIND_ICONS: Record<ListingKind, string> = {
  SALE: "🏷️",
  RENT: "📅",
  STORAGE: "📦",
  WANTED: "🔎",
  SUBLET: "🏠",
};

export function KindBadge({ kind }: { kind: ListingKind }) {
  return <span className={`chip ${KIND_STYLES[kind]}`}>{KIND_LABELS[kind]}</span>;
}

export function StatusBadge({ status }: { status: ListingStatus }) {
  if (status === "ACTIVE") return null;
  const style =
    status === "RESERVED"
      ? "bg-gold-200 text-gold-700"
      : status === "REMOVED"
        ? "bg-red-100 text-red-800"
        : "bg-stone-200 text-stone-700";
  return <span className={`chip ${style}`}>{STATUS_LABELS[status]}</span>;
}

export function ListingCard({ listing }: { listing: ListingCardData }) {
  const photo = listing.photos[0];
  const subtitle = [
    listing.condition && CONDITION_LABELS[listing.condition],
    listing.kind === "SUBLET" ? listing.city : listing.neighbourhood,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] bg-stone-100">
        {photo ? (
          // Uploaded photos are served by our own route; next/image would need a loader.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl(photo.key)}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center text-4xl text-stone-300">
            {KIND_ICONS[listing.kind]}
          </div>
        )}
        <div className="absolute top-2 left-2 flex gap-1">
          <KindBadge kind={listing.kind} />
          <StatusBadge status={listing.status} />
        </div>
        {listing.bundle && (
          <span className="chip absolute bottom-2 left-2 bg-ink/80 text-white">
            Moving out {formatDay(listing.bundle.moveOutDate)}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 p-3">
        <p className="font-semibold">
          {listing.kind === "WANTED" ? "Budget " : ""}
          {formatPrice(listing.priceCents, listing.priceUnit)}
        </p>
        <h3 className="line-clamp-2 text-sm text-stone-800 group-hover:underline">{listing.title}</h3>
        <p className="mt-auto pt-1 text-xs text-stone-500">{subtitle || CATEGORY_LABELS[listing.category]}</p>
        {listing.availableFrom && listing.availableUntil && (
          <p className="text-xs text-stone-500">
            {formatDay(listing.availableFrom)} – {formatDay(listing.availableUntil)}
          </p>
        )}
      </div>
    </Link>
  );
}

export function ListingGrid({ listings }: { listings: ListingCardData[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {listings.map((l) => (
        <ListingCard key={l.id} listing={l} />
      ))}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card px-6 py-12 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-2 text-sm text-stone-600">{children}</div>}
    </div>
  );
}
