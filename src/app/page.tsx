import Link from "next/link";
import { EmptyState, ListingGrid } from "@/components/listing-card";
import { SaveAlertButton } from "@/components/save-alert-button";
import { Category, ListingKind } from "@/generated/prisma/enums";
import { getCurrentUser } from "@/lib/auth";
import { CATEGORY_LABELS, KIND_LABELS, NEIGHBOURHOODS } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDay, todayDate } from "@/lib/format";
import {
  PAGE_SIZE,
  feedOrderBy,
  feedWhere,
  listingCardSelect,
  parseFeedFilters,
  publicListingWhere,
} from "@/lib/listings";

const FLASH: Record<string, string> = {
  verified: "Email confirmed — you're all set to post, request, and message.",
  reset: "Password updated. You're logged in.",
};

export default async function Home(props: PageProps<"/">) {
  const sp = await props.searchParams;
  const filters = parseFeedFilters(sp);
  const where = feedWhere(filters);
  const user = await getCurrentUser();

  const [listings, total, bundles] = await Promise.all([
    db.listing.findMany({
      where,
      orderBy: feedOrderBy(filters),
      select: listingCardSelect,
      take: PAGE_SIZE,
      skip: (filters.page - 1) * PAGE_SIZE,
    }),
    db.listing.count({ where }),
    // Surface move-out bundles on the unfiltered first page.
    Object.keys(sp).length === 0
      ? db.bundle.findMany({
          where: {
            moveOutDate: { gte: todayDate() },
            owner: { bannedAt: null },
            listings: { some: publicListingWhere() },
          },
          orderBy: { moveOutDate: "asc" },
          take: 4,
          include: {
            owner: { select: { name: true } },
            _count: { select: { listings: { where: publicListingWhere() } } },
          },
        })
      : Promise.resolve([]),
  ]);

  const flash = Object.keys(FLASH).find((k) => sp[k]);
  const hasFilters = !!(filters.q || filters.kind || filters.category || filters.hood || filters.minCents !== undefined || filters.maxCents !== undefined);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const query = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q: filters.q, kind: filters.kind, category: filters.category, hood: filters.hood, min: sp.min as string, max: sp.max as string, sort: filters.sort === "new" ? undefined : filters.sort, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const s = params.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <div className="space-y-5">
      {flash && <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">{FLASH[flash]}</p>}

      {!hasFilters && filters.page === 1 && (
        <section className="rounded-2xl bg-ink px-5 py-6 text-white sm:px-8 sm:py-8">
          <h1 className="text-2xl font-bold sm:text-3xl">
            Leaving for co-op? <span className="text-gold-400">Sell it, rent it, store it.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-stone-300 sm:text-base">
            The marketplace just for UWaterloo students. List your whole room in one go before
            move-out, rent a mini fridge for the term, or find someone to store your stuff.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/bundles/new" className="btn-gold">
              📦 List everything before move-out
            </Link>
            <Link href="/listings/new?kind=WANTED" className="btn border border-stone-600 text-white hover:bg-stone-800">
              🔎 Post a wanted ad
            </Link>
          </div>
        </section>
      )}

      {bundles.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Moving out soon</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {bundles.map((b) => (
              <Link key={b.id} href={`/bundles/${b.id}`} className="card p-4 hover:shadow-md">
                <p className="text-xs font-medium text-gold-700">Gone by {formatDay(b.moveOutDate)}</p>
                <p className="mt-1 line-clamp-1 font-semibold">{b.title}</p>
                <p className="text-sm text-stone-600">
                  {b._count.listings} item{b._count.listings === 1 ? "" : "s"} · {b.neighbourhood}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Listing type">
        {[undefined, ...Object.values(ListingKind)].map((kind) => (
          <Link
            key={kind ?? "all"}
            href={query({ kind, page: undefined })}
            className={`shrink-0 rounded-full border px-3 py-1 text-sm ${filters.kind === kind ? "border-ink bg-ink text-white" : "border-stone-300 bg-white hover:bg-stone-100"}`}
          >
            {kind ? KIND_LABELS[kind] : "Everything"}
          </Link>
        ))}
      </nav>

      <details className="card group" open={hasFilters || undefined}>
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">
          Filters {hasFilters && <span className="text-gold-700">(active)</span>}
          <span className="float-right text-stone-400 group-open:rotate-180">▾</span>
        </summary>
        <form className="grid gap-3 border-t border-stone-100 p-4 sm:grid-cols-2 lg:grid-cols-6" action="/">
          {filters.kind && <input type="hidden" name="kind" value={filters.kind} />}
          <div className="lg:col-span-2">
            <label className="label" htmlFor="q">Keyword</label>
            <input id="q" name="q" defaultValue={filters.q} className="input" placeholder="desk, bike, fridge…" />
          </div>
          <div>
            <label className="label" htmlFor="category">Category</label>
            <select id="category" name="category" defaultValue={filters.category ?? ""} className="input">
              <option value="">All</option>
              {Object.values(Category).map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="hood">Area</label>
            <select id="hood" name="hood" defaultValue={filters.hood ?? ""} className="input">
              <option value="">Anywhere</option>
              {NEIGHBOURHOODS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="label" htmlFor="min">Min $</label>
              <input id="min" name="min" inputMode="decimal" defaultValue={sp.min as string} className="input" />
            </div>
            <div className="flex-1">
              <label className="label" htmlFor="max">Max $</label>
              <input id="max" name="max" inputMode="decimal" defaultValue={sp.max as string} className="input" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="sort">Sort</label>
            <select id="sort" name="sort" defaultValue={filters.sort} className="input">
              <option value="new">Newest</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
            </select>
          </div>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
            <button className="btn-primary">Apply</button>
            {hasFilters && <Link href="/" className="btn-secondary">Clear</Link>}
          </div>
        </form>
      </details>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-stone-600">
          {total} listing{total === 1 ? "" : "s"}
          {filters.q && <> for “{filters.q}”</>}
        </p>
        {hasFilters && user?.emailVerifiedAt && (
          <SaveAlertButton
            filters={{
              keyword: filters.q,
              category: filters.category,
              kind: filters.kind,
              neighbourhood: filters.hood,
              maxPrice: filters.maxCents !== undefined ? String(filters.maxCents / 100) : undefined,
            }}
          />
        )}
      </div>

      {listings.length ? (
        <ListingGrid listings={listings} />
      ) : (
        <EmptyState title="Nothing here yet">
          {hasFilters ? (
            <>Try widening your filters, or <Link href="/listings/new?kind=WANTED" className="link">post a wanted ad</Link> so sellers can find you.</>
          ) : (
            <>Be the first — <Link href="/listings/new" className="link">post something</Link>.</>
          )}
        </EmptyState>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-3 text-sm">
          {filters.page > 1 && (
            <Link href={query({ page: String(filters.page - 1) })} className="btn-secondary btn-sm">← Previous</Link>
          )}
          <span className="text-stone-500">Page {filters.page} of {pages}</span>
          {filters.page < pages && (
            <Link href={query({ page: String(filters.page + 1) })} className="btn-secondary btn-sm">Next →</Link>
          )}
        </nav>
      )}
    </div>
  );
}
