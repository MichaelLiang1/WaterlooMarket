import { z } from "zod";
import {
  Category,
  Condition,
  ListingKind,
  PriceUnit,
} from "@/generated/prisma/enums";
import { fieldErrorsFrom } from "./action-state";
import { NEIGHBOURHOODS } from "./constants";
import { dollarsToCents, parseDateInput } from "./format";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const dateField = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = parseDateInput(v);
    if (!d) ctx.addIssue({ code: "custom", message: "Enter a valid date." });
    return d;
  });

const moneyField = (label: string) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v || !v.trim()) return null;
      const cents = dollarsToCents(v);
      if (cents === null) ctx.addIssue({ code: "custom", message: `Enter a valid ${label}.` });
      return cents;
    });

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(200, "That password is too long.");

export const profileSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(60),
  program: optionalText(60),
  year: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 8) {
        ctx.addIssue({ code: "custom", message: "Pick a year from 1 to 8." });
      }
      return n;
    }),
});

const listingBase = z.object({
  kind: z.enum(ListingKind),
  title: z.string().trim().min(3, "Give it a short title.").max(80, "Keep the title under 80 characters."),
  description: z.string().trim().max(2000, "Keep the description under 2000 characters.").default(""),
  category: z.enum(Category, "Pick a category."),
  condition: z
    .union([z.enum(Condition), z.literal("")])
    .optional()
    .transform((v) => (v ? v : null)),
  price: moneyField("price"),
  priceUnit: z.enum(PriceUnit).default("FLAT"),
  deposit: moneyField("deposit"),
  neighbourhood: z.string().trim().min(1, "Pick a pickup area.").max(60),
  availableFrom: dateField,
  availableUntil: dateField,
  city: optionalText(60),
  externalUrl: optionalText(500),
  bundleId: optionalText(40),
});

export type ListingInput = {
  kind: ListingKind;
  title: string;
  description: string;
  category: Category;
  condition: Condition | null;
  priceCents: number;
  priceUnit: PriceUnit;
  depositCents: number | null;
  neighbourhood: string;
  availableFrom: Date | null;
  availableUntil: Date | null;
  city: string | null;
  externalUrl: string | null;
  bundleId: string | null;
};

/**
 * Validates the create/edit listing form, applying per-kind rules:
 * which fields are required and which are dropped.
 */
export function parseListingForm(
  formData: FormData,
): { data: ListingInput } | { fieldErrors: Record<string, string> } {
  const raw = Object.fromEntries(
    [...formData.entries()].filter(([, v]) => typeof v === "string"),
  );
  const parsed = listingBase.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  const v = parsed.data;
  const errors: Record<string, string> = {};

  const isItem = v.kind === "SALE" || v.kind === "RENT";
  const isDated = v.kind === "RENT" || v.kind === "STORAGE" || v.kind === "SUBLET";

  if (v.price === null) errors.price = v.kind === "WANTED" ? "Enter your budget." : "Enter a price.";
  if (isItem && !v.condition) errors.condition = "Pick a condition.";

  let priceUnit = v.priceUnit;
  if (v.kind === "SALE" || v.kind === "WANTED") priceUnit = "FLAT";
  else if (priceUnit === "FLAT") errors.priceUnit = "Pick a rental period.";

  if (isDated) {
    if (!v.availableFrom) errors.availableFrom = "When does it become available?";
    if (!v.availableUntil) errors.availableUntil = "When does availability end?";
  }
  if (v.availableFrom && v.availableUntil && v.availableFrom > v.availableUntil) {
    errors.availableUntil = "End date must be on or after the start date.";
  }

  const outOfTown = v.kind === "SUBLET" && v.city && v.city !== "Waterloo";
  if (!outOfTown && !(NEIGHBOURHOODS as readonly string[]).includes(v.neighbourhood)) {
    errors.neighbourhood = "Pick a pickup area from the list.";
  }
  if (v.kind === "SUBLET" && !v.city) errors.city = "Which city is the sublet in?";
  if (v.externalUrl && !/^https:\/\/[^\s]+$/i.test(v.externalUrl)) {
    errors.externalUrl = "Links must start with https://";
  }

  if (Object.keys(errors).length) return { fieldErrors: errors };

  const category =
    v.kind === "STORAGE" ? "STORAGE_SPACE" : v.kind === "SUBLET" ? "HOUSING" : v.category;

  return {
    data: {
      kind: v.kind,
      title: v.title,
      description: v.description,
      category,
      condition: isItem ? v.condition : null,
      priceCents: v.price ?? 0,
      priceUnit,
      depositCents: v.kind === "RENT" || v.kind === "STORAGE" ? v.deposit : null,
      neighbourhood: v.neighbourhood,
      availableFrom: v.kind === "SALE" ? null : v.availableFrom,
      availableUntil: v.kind === "SALE" ? null : v.availableUntil,
      city: v.kind === "SUBLET" ? v.city : null,
      externalUrl: v.kind === "SUBLET" ? v.externalUrl : null,
      bundleId: v.bundleId,
    },
  };
}
