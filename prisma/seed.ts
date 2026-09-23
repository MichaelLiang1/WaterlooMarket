// Demo data for local development: `npm run db:seed`.
// Every account's password is "password123". Re-running wipes and recreates the data.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { upcomingTerms } from "../src/lib/terms";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const DAY = 24 * 60 * 60 * 1000;
const date = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);
const inDays = (n: number) => new Date(Date.now() + n * DAY);

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed production.");

  await db.user.deleteMany({ where: { email: { endsWith: "@uwaterloo.ca" } } });
  const passwordHash = await bcrypt.hash("password123", 12);
  const verified = new Date();

  const [admin, alex, priya, sam] = await Promise.all(
    [
      { email: "admin@uwaterloo.ca", name: "Admin", role: "ADMIN" as const },
      { email: "alex@uwaterloo.ca", name: "Alex Chen", program: "Computer Science", year: 3 },
      { email: "priya@uwaterloo.ca", name: "Priya Patel", program: "Mechatronics Engineering", year: 2 },
      { email: "sam@uwaterloo.ca", name: "Sam Okafor", program: "Accounting & Financial Management", year: 4 },
    ].map((u) => db.user.create({ data: { ...u, passwordHash, emailVerifiedAt: verified } })),
  );

  const [current, next] = upcomingTerms(new Date(), 2);

  const bundle = await db.bundle.create({
    data: {
      ownerId: alex.id,
      title: "Leaving for my Toronto co-op — whole room must go",
      description: "Pickup evenings after 6. 20% off if you take 3+ items.",
      moveOutDate: date(current.end),
      neighbourhood: "Northdale",
    },
  });
  const bundleExpiry = new Date(date(current.end).getTime() + DAY);

  const sale = (data: {
    title: string;
    category: "FURNITURE" | "APPLIANCES" | "BIKES" | "ELECTRONICS" | "KITCHEN" | "TEXTBOOKS" | "BEDDING" | "DECOR";
    condition: "NEW" | "GOOD" | "WORN";
    priceCents: number;
    description?: string;
  }) => ({ ...data, ownerId: alex.id, kind: "SALE" as const, neighbourhood: "Northdale", bundleId: bundle.id, expiresAt: bundleExpiry });

  await db.listing.createMany({
    data: [
      sale({ title: "IKEA LINNMON desk + legs", category: "FURNITURE", condition: "GOOD", priceCents: 3500, description: "120x60cm, white. Minor scuff on one corner." }),
      sale({ title: "Ergonomic desk chair", category: "FURNITURE", condition: "GOOD", priceCents: 4500 }),
      sale({ title: "Rice cooker (3 cup)", category: "KITCHEN", condition: "GOOD", priceCents: 1500 }),
      sale({ title: "CS 246 textbook", category: "TEXTBOOKS", condition: "WORN", priceCents: 2000 }),
      sale({ title: "Twin XL sheet set + duvet", category: "BEDDING", condition: "GOOD", priceCents: 2500 }),
    ],
  });

  await db.listing.createMany({
    data: [
      {
        ownerId: priya.id,
        kind: "RENT",
        title: "Mini fridge for the term",
        description: "3.1 cu ft Danby. Rent it for the term and give it back when you leave.",
        category: "APPLIANCES",
        condition: "GOOD",
        priceCents: 6000,
        priceUnit: "PER_TERM",
        depositCents: 5000,
        neighbourhood: "Near campus (Columbia / Phillip)",
        availableFrom: date(next.start),
        availableUntil: date(next.end),
        expiresAt: inDays(30),
      },
      {
        ownerId: priya.id,
        kind: "SALE",
        title: "Road bike, 54cm frame",
        description: "Recently tuned. Lock included.",
        category: "BIKES",
        condition: "GOOD",
        priceCents: 18000,
        neighbourhood: "Uptown Waterloo",
        expiresAt: inDays(25),
      },
      {
        ownerId: sam.id,
        kind: "STORAGE",
        title: "Dry basement storage — boxes & small furniture",
        description: "Secure, dry basement 5 min from campus. Up to ~10 boxes plus a desk.",
        category: "STORAGE_SPACE",
        priceCents: 8000,
        priceUnit: "PER_TERM",
        neighbourhood: "Lakeshore",
        availableFrom: date(next.start),
        availableUntil: date(next.end),
        expiresAt: inDays(30),
      },
      {
        ownerId: sam.id,
        kind: "SUBLET",
        title: "Room in 3-bed near King & Spadina",
        description: "Furnished, 10 min walk to most downtown co-op offices.",
        category: "HOUSING",
        priceCents: 110000,
        priceUnit: "PER_MONTH",
        neighbourhood: "Downtown / Entertainment District",
        city: "Toronto",
        externalUrl: "https://example.com/sublet",
        availableFrom: date(next.start),
        availableUntil: date(next.end),
        expiresAt: inDays(30),
      },
      {
        ownerId: priya.id,
        kind: "WANTED",
        title: `Looking for a monitor for ${next.season}`,
        description: "24\"+ with HDMI. Can pick up anywhere near campus.",
        category: "ELECTRONICS",
        priceCents: 8000,
        neighbourhood: "Village 1 (V1)",
        availableFrom: date(next.start),
        availableUntil: date(next.end),
        expiresAt: inDays(30),
      },
    ],
  });

  await db.alert.create({
    data: { userId: sam.id, keyword: "desk", maxPriceCents: 4000 },
  });

  console.log(`Seeded users: ${[admin, alex, priya, sam].map((u) => u.email).join(", ")} (password: password123)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
