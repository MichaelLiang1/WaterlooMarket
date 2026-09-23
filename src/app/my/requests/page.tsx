import type { Metadata } from "next";
import Link from "next/link";
import { cancelRequest, completeRequest, respondToRequest } from "@/app/actions/requests";
import { ActionForm, SubmitButton } from "@/components/forms";
import { EmptyState } from "@/components/listing-card";
import { ReviewForm } from "@/components/review-form";
import type { RequestStatus } from "@/generated/prisma/enums";
import { requireVerifiedUser } from "@/lib/auth";
import { REQUEST_STATUS_LABELS } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDay, formatPrice, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "My requests" };

const TABS = [
  ["outgoing", "My requests"],
  ["incoming", "On my listings"],
  ["past", "Past"],
] as const;

const STATUS_STYLES: Record<RequestStatus, string> = {
  PENDING: "bg-gold-200 text-gold-700",
  ACCEPTED: "bg-emerald-100 text-emerald-800",
  DECLINED: "bg-stone-200 text-stone-700",
  CANCELLED: "bg-stone-200 text-stone-700",
  COMPLETED: "bg-sky-100 text-sky-800",
};

const include = {
  listing: {
    select: {
      id: true,
      title: true,
      kind: true,
      priceCents: true,
      priceUnit: true,
      depositCents: true,
      ownerId: true,
      owner: { select: { id: true, name: true, email: true } },
    },
  },
  requester: { select: { id: true, name: true, email: true } },
  reviews: { select: { reviewerId: true } },
} as const;

export default async function MyRequestsPage(props: PageProps<"/my/requests">) {
  const user = await requireVerifiedUser("/my/requests");
  const { tab: tabParam } = await props.searchParams;
  const tab = TABS.some(([t]) => t === tabParam) ? (tabParam as (typeof TABS)[number][0]) : "outgoing";

  const active: RequestStatus[] = ["PENDING", "ACCEPTED"];
  const past: RequestStatus[] = ["COMPLETED", "DECLINED", "CANCELLED"];
  const where =
    tab === "outgoing"
      ? { requesterId: user.id, status: { in: active } }
      : tab === "incoming"
        ? { listing: { ownerId: user.id }, status: { in: active } }
        : { OR: [{ requesterId: user.id }, { listing: { ownerId: user.id } }], status: { in: past } };

  const [requests, incomingPending] = await Promise.all([
    db.listingRequest.findMany({
      where,
      include,
      // Postgres sorts enums in declaration order, so PENDING comes first.
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 100,
    }),
    db.listingRequest.count({ where: { listing: { ownerId: user.id }, status: "PENDING" } }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Requests & rentals</h1>
      <nav className="flex gap-1 rounded-lg bg-stone-200 p-1 text-sm">
        {TABS.map(([t, label]) => (
          <Link
            key={t}
            href={`/my/requests?tab=${t}`}
            className={`flex-1 rounded-md px-3 py-1.5 text-center ${tab === t ? "bg-white font-semibold shadow-xs" : "text-stone-600"}`}
          >
            {label}
            {t === "incoming" && incomingPending > 0 && (
              <span className="ml-1 rounded-full bg-red-600 px-1.5 text-xs text-white">{incomingPending}</span>
            )}
          </Link>
        ))}
      </nav>

      {requests.length === 0 ? (
        <EmptyState title="Nothing here">
          {tab === "outgoing" ? (
            <>
              <Link href="/" className="link">Browse listings</Link> and send a request to rent or buy.
            </>
          ) : tab === "incoming" ? (
            "Requests on your listings will show up here."
          ) : (
            "Finished, declined, and cancelled requests will show up here."
          )}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => {
            const iOwn = r.listing.ownerId === user.id;
            const other = iOwn ? r.requester : r.listing.owner;
            const reviewed = r.reviews.some((rv) => rv.reviewerId === user.id);
            const showContact = r.status === "ACCEPTED" || r.status === "COMPLETED";
            return (
              <li key={r.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/listings/${r.listing.id}`} className="font-semibold hover:underline">
                      {r.listing.title}
                    </Link>
                    <p className="text-sm text-stone-600">
                      {iOwn ? (
                        <>
                          From <Link href={`/users/${other.id}`} className="link">{other.name}</Link>
                        </>
                      ) : (
                        <>
                          Owner: <Link href={`/users/${other.id}`} className="link">{other.name}</Link>
                        </>
                      )}{" "}
                      · {formatPrice(r.listing.priceCents, r.listing.priceUnit)} · {timeAgo(r.createdAt)}
                    </p>
                    <p className="text-sm">
                      {r.startDate ? (
                        <>📅 {formatDay(r.startDate)} – {formatDay(r.endDate)}</>
                      ) : (
                        <>🏷️ Purchase</>
                      )}
                    </p>
                  </div>
                  <span className={`chip ${STATUS_STYLES[r.status]}`}>{REQUEST_STATUS_LABELS[r.status]}</span>
                </div>

                {r.message && <p className="mt-2 rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-700">“{r.message}”</p>}

                {showContact && (
                  <p className="mt-2 text-sm">
                    📧 Contact {other.name}:{" "}
                    <a href={`mailto:${other.email}`} className="link">{other.email}</a>
                    {r.listing.depositCents && r.status === "ACCEPTED" ? (
                      <span className="block text-xs text-stone-600">
                        Deposit: {formatPrice(r.listing.depositCents)}, handled in person.
                      </span>
                    ) : null}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {iOwn && r.status === "PENDING" && (
                    <>
                      <ActionForm action={respondToRequest}>
                        <input type="hidden" name="requestId" value={r.id} />
                        <input type="hidden" name="decision" value="accept" />
                        <SubmitButton className="btn-gold btn-sm" pendingText="Accepting…">Accept</SubmitButton>
                      </ActionForm>
                      <ActionForm action={respondToRequest}>
                        <input type="hidden" name="requestId" value={r.id} />
                        <input type="hidden" name="decision" value="decline" />
                        <SubmitButton className="btn-secondary btn-sm">Decline</SubmitButton>
                      </ActionForm>
                    </>
                  )}
                  {iOwn && r.status === "ACCEPTED" && r.startDate && (
                    <ActionForm action={completeRequest}>
                      <input type="hidden" name="requestId" value={r.id} />
                      <SubmitButton className="btn-secondary btn-sm">Mark returned</SubmitButton>
                    </ActionForm>
                  )}
                  {iOwn && r.status === "ACCEPTED" && !r.startDate && (
                    <Link href={`/listings/${r.listing.id}`} className="btn-secondary btn-sm">
                      Mark sold / release →
                    </Link>
                  )}
                  {!iOwn && (r.status === "PENDING" || r.status === "ACCEPTED") && (
                    <ActionForm action={cancelRequest} confirm="Cancel this request?">
                      <input type="hidden" name="requestId" value={r.id} />
                      <SubmitButton className="btn-danger btn-sm">Cancel request</SubmitButton>
                    </ActionForm>
                  )}
                </div>

                {r.status === "COMPLETED" &&
                  (reviewed ? (
                    <p className="mt-2 text-xs text-stone-500">✓ You reviewed {other.name}.</p>
                  ) : (
                    <ReviewForm requestId={r.id} name={other.name} />
                  ))}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
