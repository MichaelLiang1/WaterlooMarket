import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { Category, ListingKind } from "@/generated/prisma/enums";
import { LISTING_TTL_DAYS } from "./constants";
import { db } from "./db";
import { dollarsToCents } from "./format";

export const PAGE_SIZE = 24;

/** Listings anyone can see in the feed. */
export function publicListingWhere(): Prisma.ListingWhereInput {
  return {
    status: { in: ["ACTIVE", "RESERVED"] },
    expiresAt: { gt: new Date() },
    owner: { bannedAt: null },
  };
}

export const listingCardSelect = {
  id: true,
  kind: true,
  title: true,
  category: true,
  condition: true,
  priceCents: true,
  priceUnit: true,
  neighbourhood: true,
  city: true,
  status: true,
  availableFrom: true,
  availableUntil: true,
  expiresAt: true,
  createdAt: true,
  bundle: { select: { id: true, moveOutDate: true } },
  photos: { select: { key: true }, orderBy: { position: "asc" }, take: 1 },
} satisfies Prisma.ListingSelect;

export type ListingCardData = Prisma.ListingGetPayload<{ select: typeof listingCardSelect }>;

export type FeedFilters = {
  q?: string;
  kind?: ListingKind;
  category?: Category;
  minCents?: number;
  maxCents?: number;
  hood?: string;
  sort: "new" | "price_asc" | "price_desc";
  page: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseFeedFilters(sp: SearchParams): FeedFilters {
  const kind = one(sp.kind);
  const category = one(sp.category);
  const sort = one(sp.sort);
  const page = Number(one(sp.page) ?? 1);
  return {
    q: one(sp.q)?.trim().slice(0, 100) || undefined,
    kind: kind && kind in ListingKind ? (kind as ListingKind) : undefined,
    category: category && category in Category ? (category as Category) : undefined,
    minCents: dollarsToCents(one(sp.min)) ?? undefined,
    maxCents: dollarsToCents(one(sp.max)) ?? undefined,
    hood: one(sp.hood) || undefined,
    sort: sort === "price_asc" || sort === "price_desc" ? sort : "new",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export function feedWhere(f: FeedFilters): Prisma.ListingWhereInput {
  const where: Prisma.ListingWhereInput = { ...publicListingWhere() };
  const and: Prisma.ListingWhereInput[] = [];
  if (f.q) {
    const words = f.q.split(/\s+/).filter(Boolean).slice(0, 6);
    for (const word of words) {
      and.push({
        OR: [
          { title: { contains: word, mode: "insensitive" } },
          { description: { contains: word, mode: "insensitive" } },
        ],
      });
    }
  }
  if (f.kind) where.kind = f.kind;
  if (f.category) where.category = f.category;
  if (f.hood) where.neighbourhood = f.hood;
  if (f.minCents !== undefined || f.maxCents !== undefined) {
    where.priceCents = { gte: f.minCents, lte: f.maxCents };
  }
  if (and.length) where.AND = and;
  return where;
}

export function feedOrderBy(f: FeedFilters): Prisma.ListingOrderByWithRelationInput[] {
  if (f.sort === "price_asc") return [{ priceCents: "asc" }, { createdAt: "desc" }];
  if (f.sort === "price_desc") return [{ priceCents: "desc" }, { createdAt: "desc" }];
  return [{ createdAt: "desc" }];
}

export function defaultExpiry(from = new Date()) {
  return new Date(from.getTime() + LISTING_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** Bundle items stay up until the end of move-out day. */
export function bundleExpiry(moveOutDate: Date) {
  return new Date(moveOutDate.getTime() + 24 * 60 * 60 * 1000);
}

/** Accepted/completed date ranges, for the availability calendar. */
export async function bookedRanges(listingId: string) {
  return db.listingRequest.findMany({
    where: {
      listingId,
      status: { in: ["ACCEPTED", "COMPLETED"] },
      startDate: { not: null },
    },
    select: { startDate: true, endDate: true },
    orderBy: { startDate: "asc" },
  }) as Promise<{ startDate: Date; endDate: Date }[]>;
}

export async function userRating(userId: string) {
  const agg = await db.review.aggregate({
    where: { revieweeId: userId },
    _avg: { rating: true },
    _count: true,
  });
  return { average: agg._avg.rating, count: agg._count };
}
