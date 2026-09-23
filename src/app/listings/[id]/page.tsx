import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { removeListing, restoreListing } from "@/app/actions/admin";
import { deleteListing, renewListing, setListingStatus } from "@/app/actions/listings";
import { startConversation } from "@/app/actions/messages";
import { createRequest } from "@/app/actions/requests";
import { toggleFavorite } from "@/app/actions/social";
import { AvailabilityCalendar } from "@/components/availability-calendar";
import { DateRangeFields } from "@/components/date-range-fields";
import { ActionForm, SubmitButton } from "@/components/forms";
import { KindBadge, StatusBadge } from "@/components/listing-card";
import { PhotoGallery } from "@/components/photo-gallery";
import { ReportForm } from "@/components/report-form";
import { Stars } from "@/components/stars";
import { getCurrentUser } from "@/lib/auth";
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  DATED_KINDS,
  REQUEST_STATUS_LABELS,
  REQUESTABLE_KINDS,
} from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDay, formatPrice, timeAgo, toDateInput, todayDate } from "@/lib/format";
import { bookedRanges, userRating } from "@/lib/listings";
import { upcomingTerms } from "@/lib/terms";
import { imageUrl } from "@/lib/image-url";

async function loadListing(id: string) {
  return db.listing.findUnique({
    where: { id },
    include: {
      photos: { orderBy: { position: "asc" } },
      owner: { select: { id: true, name: true, program: true, year: true, bannedAt: true, createdAt: true } },
      bundle: { include: { _count: { select: { listings: true } } } },
    },
  });
}

export async function generateMetadata(props: PageProps<"/listings/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const listing = await db.listing.findUnique({ where: { id }, select: { title: true } });
  return { title: listing?.title ?? "Listing" };
}

export default async function ListingPage(props: PageProps<"/listings/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const [listing, user] = await Promise.all([loadListing(id), getCurrentUser()]);
  if (!listing) notFound();

  const isOwner = user?.id === listing.ownerId;
  const isAdmin = user?.role === "ADMIN";
  const expired = listing.expiresAt < new Date();
  const hidden = listing.status === "REMOVED" || listing.owner.bannedAt || expired;
  if (hidden && !isOwner && !isAdmin) notFound();

  const dated = DATED_KINDS.includes(listing.kind);
  const [booked, rating, favorite, myRequest, conversation, pendingCount] = await Promise.all([
    dated ? bookedRanges(listing.id) : Promise.resolve([]),
    userRating(listing.ownerId),
    user ? db.favorite.findUnique({ where: { userId_listingId: { userId: user.id, listingId: listing.id } } }) : null,
    user && !isOwner
      ? db.listingRequest.findFirst({
          where: { listingId: listing.id, requesterId: user.id },
          orderBy: { createdAt: "desc" },
        })
      : null,
    user && !isOwner
      ? db.conversation.findUnique({ where: { listingId_buyerId: { listingId: listing.id, buyerId: user.id } } })
      : null,
    isOwner ? db.listingRequest.count({ where: { listingId: listing.id, status: "PENDING" } }) : 0,
  ]);

  const today = todayDate();
  const canRequest =
    !isOwner &&
    REQUESTABLE_KINDS.includes(listing.kind) &&
    !hidden &&
    (dated ? listing.status !== "SOLD" && listing.status !== "UNAVAILABLE" : listing.status === "ACTIVE") &&
    !(myRequest && myRequest.status === "PENDING");
  const requestMin = listing.availableFrom && listing.availableFrom > today ? listing.availableFrom : today;
  const isAvailable = listing.status === "ACTIVE" || listing.status === "RESERVED";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-5">
        {sp.posted && (
          <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
            Your listing is live! Share the link, <Link href="/listings/new" className="link">post another</Link>, or see{" "}
            <Link href="/my/listings" className="link">all your listings</Link>.
          </p>
        )}
        {hidden && (
          <p className="rounded-lg bg-gold-100 px-4 py-3 text-sm text-gold-700">
            {listing.status === "REMOVED"
              ? "A moderator removed this listing. Only you and admins can see it."
              : listing.owner.bannedAt
                ? "This user is banned; the listing is hidden."
                : "This listing has expired and is hidden from the feed. Renew it to bring it back."}
          </p>
        )}

        {listing.kind !== "WANTED" && (
          <PhotoGallery urls={listing.photos.map((p) => imageUrl(p.key))} alt={listing.title} />
        )}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <KindBadge kind={listing.kind} />
            <StatusBadge status={listing.status} />
            <span className="chip bg-stone-100 text-stone-700">{CATEGORY_LABELS[listing.category]}</span>
            {listing.condition && (
              <span className="chip bg-stone-100 text-stone-700">{CONDITION_LABELS[listing.condition]}</span>
            )}
          </div>
          <h1 className="text-2xl font-bold">{listing.title}</h1>
          <p className="text-2xl font-semibold">
            {listing.kind === "WANTED" && <span className="text-base font-normal text-stone-500">Budget up to </span>}
            {formatPrice(listing.priceCents, listing.priceUnit)}
          </p>
          {listing.depositCents ? (
            <p className="text-sm text-stone-700">
              💵 Owner asks for a <strong>{formatPrice(listing.depositCents)} deposit</strong>, handled in person and returned at the end.
            </p>
          ) : null}
        </div>

        <dl className="card grid grid-cols-2 gap-x-4 gap-y-3 p-4 text-sm">
          <div>
            <dt className="text-stone-500">{listing.kind === "SUBLET" ? "Location" : "Pickup area"}</dt>
            <dd className="font-medium">
              {listing.kind === "SUBLET" ? `${listing.neighbourhood}, ${listing.city}` : listing.neighbourhood}
            </dd>
          </div>
          {listing.availableFrom && listing.availableUntil && (
            <div>
              <dt className="text-stone-500">{listing.kind === "WANTED" ? "Needed" : "Available"}</dt>
              <dd className="font-medium">
                {formatDay(listing.availableFrom)} – {formatDay(listing.availableUntil)}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-stone-500">Posted</dt>
            <dd className="font-medium">{timeAgo(listing.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-stone-500">{expired ? "Expired" : "Expires"}</dt>
            <dd className="font-medium">{formatDay(listing.expiresAt)}</dd>
          </div>
        </dl>

        {listing.bundle && (
          <Link href={`/bundles/${listing.bundle.id}`} className="card flex items-center justify-between gap-3 border-gold-300 bg-gold-50 p-4 hover:shadow-md">
            <div>
              <p className="text-sm font-semibold">📦 Part of “{listing.bundle.title}”</p>
              <p className="text-xs text-stone-600">
                Seller moves out {formatDay(listing.bundle.moveOutDate)} · {listing.bundle._count.listings} items
              </p>
            </div>
            <span className="text-sm">→</span>
          </Link>
        )}

        {listing.description && (
          <section>
            <h2 className="mb-1 font-semibold">Details</h2>
            <p className="text-sm whitespace-pre-line text-stone-800">{listing.description}</p>
          </section>
        )}

        {dated && listing.availableFrom && listing.availableUntil && (
          <section className="card p-4">
            <h2 className="mb-3 font-semibold">Availability</h2>
            <AvailabilityCalendar from={listing.availableFrom} until={listing.availableUntil} booked={booked} />
          </section>
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Link href={`/users/${listing.owner.id}`} className="card flex items-center gap-3 p-4 hover:shadow-md">
          <span className="grid size-10 place-items-center rounded-full bg-gold-300 font-bold">
            {listing.owner.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="font-semibold">{listing.owner.name}</p>
            <p className="truncate text-xs text-stone-500">
              {[listing.owner.program, listing.owner.year && `Year ${listing.owner.year}`].filter(Boolean).join(" · ") || `Member since ${formatDay(listing.owner.createdAt)}`}
            </p>
            {rating.count > 0 ? (
              <Stars value={rating.average ?? 0} count={rating.count} />
            ) : (
              <p className="text-xs text-stone-500">No reviews yet</p>
            )}
          </div>
        </Link>

        {isOwner ? (
          <div className="card space-y-3 p-4">
            <h2 className="font-semibold">Manage your listing</h2>
            {pendingCount > 0 && (
              <Link href="/my/requests?tab=incoming" className="block rounded-lg bg-gold-100 px-3 py-2 text-sm font-medium">
                {pendingCount} pending request{pendingCount === 1 ? "" : "s"} →
              </Link>
            )}
            <div className="flex flex-wrap gap-2">
              <Link href={`/listings/${listing.id}/edit`} className="btn-secondary btn-sm">
                ✏️ Edit
              </Link>
              {listing.status !== "REMOVED" &&
                (
                  [
                    ["ACTIVE", "Mark available"],
                    ...(dated ? [] : [["RESERVED", "Mark reserved"], ["SOLD", "Mark sold"]]),
                    ["UNAVAILABLE", "Mark unavailable"],
                  ] as const
                )
                  .filter(([s]) => s !== listing.status)
                  .map(([status, label]) => (
                    <ActionForm key={status} action={setListingStatus} showSuccess={false}>
                      <input type="hidden" name="listingId" value={listing.id} />
                      <input type="hidden" name="status" value={status} />
                      <SubmitButton className="btn-secondary btn-sm">{label}</SubmitButton>
                    </ActionForm>
                  ))}
              {listing.status !== "REMOVED" && (
                <ActionForm action={renewListing}>
                  <input type="hidden" name="listingId" value={listing.id} />
                  <SubmitButton className="btn-secondary btn-sm">↻ Renew 30 days</SubmitButton>
                </ActionForm>
              )}
            </div>
            <ActionForm action={deleteListing} confirm="Delete this listing permanently? Pending requests will be cancelled.">
              <input type="hidden" name="listingId" value={listing.id} />
              <SubmitButton className="btn-danger btn-sm" pendingText="Deleting…">
                Delete listing
              </SubmitButton>
            </ActionForm>
          </div>
        ) : !user ? (
          <div className="card space-y-2 p-4 text-sm">
            <p>Log in with your school email to request or message.</p>
            <Link href={`/login?next=/listings/${listing.id}`} className="btn-primary w-full">
              Log in
            </Link>
            <Link href="/signup" className="btn-secondary w-full">
              Create an account
            </Link>
          </div>
        ) : !user.emailVerifiedAt ? (
          <div className="card p-4 text-sm">
            <Link href="/verify-email" className="link">Confirm your email</Link> to request or message.
          </div>
        ) : (
          <>
            {myRequest && (
              <div className="card p-4 text-sm">
                <p>
                  Your request:{" "}
                  <strong>{REQUEST_STATUS_LABELS[myRequest.status]}</strong>
                  {myRequest.startDate && ` (${formatDay(myRequest.startDate)} – ${formatDay(myRequest.endDate)})`}
                </p>
                <Link href="/my/requests" className="link">View my requests →</Link>
              </div>
            )}

            {canRequest && (
              <div className="card p-4">
                <h2 className="mb-2 font-semibold">
                  {dated ? (listing.kind === "STORAGE" ? "Book storage" : "Request to rent") : "Ask to buy"}
                </h2>
                <ActionForm action={createRequest} className="space-y-3" resetOnSuccess>
                  <input type="hidden" name="listingId" value={listing.id} />
                  {dated && listing.availableUntil && (
                    <DateRangeFields
                      terms={upcomingTerms(new Date(), 3)}
                      fromName="startDate"
                      untilName="endDate"
                      fromLabel="Start"
                      untilLabel="End"
                      min={toDateInput(requestMin)}
                      max={toDateInput(listing.availableUntil)}
                      required
                    />
                  )}
                  <textarea
                    name="message"
                    rows={2}
                    maxLength={1000}
                    placeholder={dated ? "Hi! I'd love to rent this for my term…" : "Hi! Is this still available? I can pick up this week."}
                    className="input"
                  />
                  <SubmitButton className="btn-gold w-full" pendingText="Sending…">
                    Send request
                  </SubmitButton>
                  <p className="text-xs text-stone-500">
                    Once the owner accepts, you&apos;ll both see each other&apos;s email to arrange pickup.
                  </p>
                </ActionForm>
              </div>
            )}

            {listing.kind === "SUBLET" && listing.externalUrl && (
              <a href={listing.externalUrl} target="_blank" rel="noopener noreferrer nofollow" className="btn-gold w-full">
                View full sublet listing ↗
              </a>
            )}

            {isAvailable && !hidden && (
              <div className="card p-4">
                {conversation ? (
                  <Link href={`/messages/${conversation.id}`} className="btn-secondary w-full">
                    💬 Open conversation
                  </Link>
                ) : (
                  <ActionForm action={startConversation} className="space-y-2">
                    <input type="hidden" name="listingId" value={listing.id} />
                    <label htmlFor="body" className="label">
                      {listing.kind === "WANTED" ? `Have what ${listing.owner.name.split(" ")[0]} needs?` : `Message ${listing.owner.name.split(" ")[0]}`}
                    </label>
                    <textarea
                      id="body"
                      name="body"
                      rows={2}
                      required
                      maxLength={2000}
                      defaultValue={listing.kind === "WANTED" ? "Hi! I have one you might be interested in — " : "Hi! Is this still available?"}
                      className="input"
                    />
                    <SubmitButton className="btn-secondary w-full" pendingText="Sending…">
                      Send message
                    </SubmitButton>
                  </ActionForm>
                )}
              </div>
            )}
          </>
        )}

        <div className="flex items-center justify-between px-1">
          {user && !isOwner ? (
            <ActionForm action={toggleFavorite} showSuccess={false}>
              <input type="hidden" name="listingId" value={listing.id} />
              <SubmitButton className="btn-secondary btn-sm">{favorite ? "♥ Saved" : "♡ Save"}</SubmitButton>
            </ActionForm>
          ) : (
            <span />
          )}
          {user?.emailVerifiedAt && !isOwner && <ReportForm listingId={listing.id} label="Report listing" />}
        </div>

        {isAdmin && !isOwner && (
          <div className="card space-y-2 border-red-200 p-4">
            <h2 className="text-sm font-semibold text-red-800">Moderator</h2>
            {listing.status === "REMOVED" ? (
              <ActionForm action={restoreListing}>
                <input type="hidden" name="listingId" value={listing.id} />
                <SubmitButton className="btn-secondary btn-sm">Restore listing</SubmitButton>
              </ActionForm>
            ) : (
              <ActionForm action={removeListing} className="space-y-2" confirm="Remove this listing?">
                <input type="hidden" name="listingId" value={listing.id} />
                <input name="reason" placeholder="Reason (sent to the owner)" className="input" />
                <SubmitButton className="btn-danger btn-sm">Remove listing</SubmitButton>
              </ActionForm>
            )}
            <Link href={`/admin?user=${listing.owner.id}`} className="link text-sm">
              Manage user →
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
