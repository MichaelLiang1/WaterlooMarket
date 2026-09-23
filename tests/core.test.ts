// Run with `npm test` (needs `npm run db:dev` running). Uses the dev database
// but only touches rows it creates, under @test.uwaterloo.ca emails.
import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { isConstraintViolation } from "../src/lib/db-errors";
import { formatPrice, parseDateInput } from "../src/lib/format";
import { nextTerm, termLabelFor, upcomingTerms } from "../src/lib/terms";
import { parseListingForm } from "../src/lib/validation";
import { db } from "../src/lib/db";
import { runDailyJobs } from "../src/lib/jobs";
import { notifyMatchingAlerts } from "../src/lib/notify";

const d = (ymd: string) => parseDateInput(ymd)!;

describe("terms", () => {
  test("presets follow the Waterloo calendar", () => {
    const terms = upcomingTerms(new Date(2026, 8, 23), 4);
    assert.deepEqual(
      terms.map((t) => [t.label, t.start, t.end]),
      [
        ["Fall 2026 (Sep–Dec)", "2026-09-01", "2026-12-31"],
        ["Winter 2027 (Jan–Apr)", "2027-01-01", "2027-04-30"],
        ["Spring 2027 (May–Aug)", "2027-05-01", "2027-08-31"],
        ["Fall 2027 (Sep–Dec)", "2027-09-01", "2027-12-31"],
      ],
    );
    assert.equal(nextTerm(new Date(2026, 11, 31)).label, "Winter 2027 (Jan–Apr)");
    assert.equal(termLabelFor("2027-05-01", "2027-08-31"), "Spring 2027 (May–Aug)");
    assert.equal(termLabelFor("2027-05-02", "2027-08-31"), null);
  });
});

describe("formatting", () => {
  test("prices", () => {
    assert.equal(formatPrice(0), "Free");
    assert.equal(formatPrice(4000), "$40");
    assert.equal(formatPrice(6050, "PER_TERM"), "$60.50 / term");
  });
});

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("listing validation", () => {
  const base = { title: "Mini fridge", category: "APPLIANCES", neighbourhood: "Northdale", price: "60" };

  test("sale requires condition and forces a flat price", () => {
    const bad = parseListingForm(form({ ...base, kind: "SALE" }));
    assert.ok("fieldErrors" in bad && bad.fieldErrors.condition);
    const good = parseListingForm(form({ ...base, kind: "SALE", condition: "GOOD", priceUnit: "PER_TERM", availableFrom: "2027-01-01" }));
    assert.ok("data" in good);
    assert.equal(good.data.priceUnit, "FLAT");
    assert.equal(good.data.availableFrom, null);
    assert.equal(good.data.priceCents, 6000);
  });

  test("rent requires a period and a valid window", () => {
    const r = parseListingForm(form({ ...base, kind: "RENT", condition: "GOOD", priceUnit: "FLAT", availableFrom: "2027-04-30", availableUntil: "2027-01-01" }));
    assert.ok("fieldErrors" in r);
    assert.ok(r.fieldErrors.priceUnit);
    assert.ok(r.fieldErrors.availableUntil);
  });

  test("storage and sublet force their category; out-of-town sublets allow free-text areas", () => {
    const s = parseListingForm(form({ ...base, kind: "STORAGE", priceUnit: "PER_TERM", availableFrom: "2027-01-01", availableUntil: "2027-04-30" }));
    assert.ok("data" in s && s.data.category === "STORAGE_SPACE" && s.data.condition === null);
    const sub = parseListingForm(form({ ...base, kind: "SUBLET", city: "Toronto", neighbourhood: "Liberty Village", priceUnit: "PER_MONTH", availableFrom: "2027-01-01", availableUntil: "2027-04-30", externalUrl: "javascript:alert(1)" }));
    assert.ok("fieldErrors" in sub && sub.fieldErrors.externalUrl && !sub.fieldErrors.neighbourhood);
  });

  test("pickup area must be a known neighbourhood", () => {
    const r = parseListingForm(form({ ...base, kind: "SALE", condition: "GOOD", neighbourhood: "123 Fake St" }));
    assert.ok("fieldErrors" in r && r.fieldErrors.neighbourhood);
  });
});

describe("database rules", () => {
  let ownerId: string;
  let renterId: string;
  let listingId: string;

  before(async () => {
    await db.user.deleteMany({ where: { email: { endsWith: "@test.uwaterloo.ca" } } });
    const mk = (email: string) =>
      db.user.create({ data: { email, name: email.split("@")[0], passwordHash: "x", emailVerifiedAt: new Date() } });
    ownerId = (await mk("owner@test.uwaterloo.ca")).id;
    renterId = (await mk("renter@test.uwaterloo.ca")).id;
    listingId = (
      await db.listing.create({
        data: {
          ownerId,
          kind: "RENT",
          title: "Test fridge",
          category: "APPLIANCES",
          condition: "GOOD",
          priceCents: 6000,
          priceUnit: "PER_TERM",
          neighbourhood: "Northdale",
          availableFrom: d("2030-01-01"),
          availableUntil: d("2030-04-30"),
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      })
    ).id;
  });

  after(async () => {
    await db.user.deleteMany({ where: { email: { endsWith: "@test.uwaterloo.ca" } } });
    await db.$disconnect();
  });

  const book = (start: string, end: string, status: "PENDING" | "ACCEPTED" = "ACCEPTED") =>
    db.listingRequest.create({ data: { listingId, requesterId: renterId, startDate: d(start), endDate: d(end), status } });

  test("overlapping accepted bookings are rejected by the exclusion constraint", async () => {
    await book("2030-01-01", "2030-01-31");
    await assert.rejects(book("2030-01-31", "2030-02-10"), (err) => isConstraintViolation(err, "ListingRequest_no_overlap"));
    // Adjacent ranges and pending overlaps are fine.
    await book("2030-02-01", "2030-02-10");
    await book("2030-01-15", "2030-01-20", "PENDING");
  });

  test("accepting a pending request that overlaps is rejected", async () => {
    const pending = await book("2030-01-05", "2030-01-06", "PENDING");
    await assert.rejects(
      db.listingRequest.update({ where: { id: pending.id }, data: { status: "ACCEPTED" } }),
      (err) => isConstraintViolation(err, "ListingRequest_no_overlap"),
    );
  });

  test("only one accepted buyer per sale listing", async () => {
    const sale = await db.listing.create({
      data: { ownerId, kind: "SALE", title: "Test desk", category: "FURNITURE", condition: "GOOD", priceCents: 1000, neighbourhood: "Northdale", expiresAt: new Date(Date.now() + 86_400_000) },
    });
    await db.listingRequest.create({ data: { listingId: sale.id, requesterId: renterId, status: "ACCEPTED" } });
    await assert.rejects(
      db.listingRequest.create({ data: { listingId: sale.id, requesterId: ownerId, status: "ACCEPTED" } }),
      (err) => isConstraintViolation(err, "ListingRequest_one_accepted_sale"),
    );
  });

  test("end date before start date is rejected", async () => {
    await assert.rejects(book("2030-03-10", "2030-03-01", "PENDING"), (err) => isConstraintViolation(err, "ListingRequest_dates_valid"));
  });

  test("alerts match by keyword and max price, and skip the poster", async () => {
    await db.alert.createMany({
      data: [
        { userId: renterId, keyword: "desk", maxPriceCents: 4000 },
        { userId: ownerId, keyword: "desk" },
      ],
    });
    const cheap = await db.listing.create({
      data: { ownerId, kind: "SALE", title: "Standing DESK", category: "FURNITURE", condition: "GOOD", priceCents: 3000, neighbourhood: "Northdale", expiresAt: new Date(Date.now() + 86_400_000) },
    });
    const pricey = await db.listing.create({
      data: { ownerId, kind: "SALE", title: "Fancy desk", category: "FURNITURE", condition: "GOOD", priceCents: 9000, neighbourhood: "Northdale", expiresAt: new Date(Date.now() + 86_400_000) },
    });
    await notifyMatchingAlerts(cheap);
    await notifyMatchingAlerts(pricey);
    const notes = await db.notification.findMany({ where: { type: "alert_match", userId: { in: [ownerId, renterId] } } });
    assert.deepEqual(notes.map((n) => [n.userId, n.link]), [[renterId, `/listings/${cheap.id}`]]);
  });

  test("daily jobs warn about expiring listings once and complete past bookings", async () => {
    const soon = await db.listing.create({
      data: { ownerId, kind: "SALE", title: "Expiring lamp", category: "DECOR", condition: "GOOD", priceCents: 500, neighbourhood: "Northdale", expiresAt: new Date(Date.now() + 2 * 86_400_000) },
    });
    const past = await db.listingRequest.create({
      data: { listingId, requesterId: renterId, startDate: d("2020-01-01"), endDate: d("2020-01-05"), status: "ACCEPTED" },
    });
    const oldHit = await db.rateLimitHit.create({
      data: { key: "login:ip:203.0.113.9", createdAt: new Date(Date.now() - 2 * 86_400_000) },
    });
    const freshHit = await db.rateLimitHit.create({ data: { key: "login:ip:203.0.113.9" } });
    await runDailyJobs();
    await runDailyJobs();
    // Privacy policy: IP addresses kept for abuse prevention are deleted within ~2 days.
    assert.equal(await db.rateLimitHit.count({ where: { id: oldHit.id } }), 0);
    assert.equal(await db.rateLimitHit.count({ where: { id: freshHit.id } }), 1);
    await db.rateLimitHit.delete({ where: { id: freshHit.id } });
    const warnings = await db.notification.count({ where: { userId: ownerId, type: "listing_expiring", body: { contains: "Renew" }, title: { contains: soon.title } } });
    assert.equal(warnings, 1);
    assert.equal((await db.listingRequest.findUniqueOrThrow({ where: { id: past.id } })).status, "COMPLETED");
  });
});
