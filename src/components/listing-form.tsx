"use client";

import Link from "next/link";
import { useState } from "react";
import { createListing, updateListing } from "@/app/actions/listings";
import { Category, Condition, ListingKind } from "@/generated/prisma/enums";
import type { PriceUnit } from "@/generated/prisma/enums";
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  KIND_DESCRIPTIONS,
  KIND_LABELS,
  NEIGHBOURHOODS,
  WORK_TERM_CITIES,
} from "@/lib/constants";
import type { Term } from "@/lib/terms";
import { DateRangeFields } from "./date-range-fields";
import { ActionForm, Field, SubmitButton } from "./forms";
import { PhotoInput } from "./photo-input";

export type ListingFormValues = {
  id?: string;
  kind: ListingKind;
  title: string;
  description: string;
  category: Category | "";
  condition: Condition | "";
  price: string;
  priceUnit: PriceUnit;
  deposit: string;
  neighbourhood: string;
  availableFrom: string;
  availableUntil: string;
  city: string;
  externalUrl: string;
  bundleId: string;
  photos: { id: string; url: string }[];
};

const RENTAL_UNITS: [PriceUnit, string][] = [
  ["PER_DAY", "per day"],
  ["PER_WEEK", "per week"],
  ["PER_MONTH", "per month"],
  ["PER_TERM", "per term"],
];

export function ListingForm({
  initial,
  terms,
  bundles,
}: {
  initial: ListingFormValues;
  terms: Term[];
  bundles: { id: string; title: string }[];
}) {
  const editing = !!initial.id;
  const [kind, setKind] = useState<ListingKind>(initial.kind);
  const [city, setCity] = useState(initial.city || "Waterloo");

  const isItem = kind === "SALE" || kind === "RENT";
  const isDated = kind === "RENT" || kind === "STORAGE" || kind === "SUBLET";
  const outOfTown = kind === "SUBLET" && city !== "Waterloo";

  const titlePlaceholder: Record<ListingKind, string> = {
    SALE: "IKEA desk, barely used",
    RENT: "Mini fridge for the term",
    STORAGE: "Dry basement space near Northdale",
    WANTED: "Looking for a mini fridge Jan–Apr",
    SUBLET: "Room in 3-bed near King & Queen, Toronto",
  };

  return (
    <ActionForm action={editing ? updateListing : createListing} className="space-y-6">
      {editing && <input type="hidden" name="listingId" value={initial.id} />}
      <input type="hidden" name="kind" value={kind} />

      {!editing && (
        <fieldset>
          <legend className="label">What are you posting?</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {Object.values(ListingKind).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded-lg border p-3 text-left transition ${kind === k ? "border-ink bg-ink text-white" : "border-stone-300 bg-white hover:border-stone-400"}`}
              >
                <span className="block text-sm font-semibold">{KIND_LABELS[k]}</span>
                <span className={`block text-xs ${kind === k ? "text-stone-300" : "text-stone-500"}`}>
                  {KIND_DESCRIPTIONS[k]}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className="card space-y-4 p-4 sm:p-6">
        <Field label="Title" name="title">
          <input id="title" name="title" required maxLength={80} defaultValue={initial.title} placeholder={titlePlaceholder[kind]} className="input" />
        </Field>

        <Field label="Description" name="description" hint="Dimensions, brand, what's included, pickup times…">
          <textarea id="description" name="description" rows={4} maxLength={2000} defaultValue={initial.description} className="input" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          {kind === "STORAGE" || kind === "SUBLET" ? (
            <input type="hidden" name="category" value={kind === "STORAGE" ? "STORAGE_SPACE" : "HOUSING"} />
          ) : (
            <Field label="Category" name="category">
              <select id="category" name="category" required defaultValue={initial.category} className="input">
                <option value="" disabled>
                  Choose…
                </option>
                {Object.values(Category)
                  .filter((c) => c !== "STORAGE_SPACE" && c !== "HOUSING")
                  .map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
              </select>
            </Field>
          )}

          {isItem && (
            <Field label="Condition" name="condition">
              <div className="flex gap-2">
                {Object.values(Condition).map((c) => (
                  <label key={c} className="flex-1 cursor-pointer">
                    <input type="radio" name="condition" value={c} defaultChecked={initial.condition === c} className="peer sr-only" required />
                    <span className="block rounded-lg border border-stone-300 py-2 text-center text-sm peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white">
                      {CONDITION_LABELS[c]}
                    </span>
                  </label>
                ))}
              </div>
            </Field>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={kind === "WANTED" ? "Max budget ($)" : "Price ($)"} name="price" hint={kind === "SALE" ? "Enter 0 to give it away free." : undefined}>
            <div className="flex gap-2">
              <input id="price" name="price" inputMode="decimal" required defaultValue={initial.price} placeholder="40" className="input" />
              {isDated && (
                <select name="priceUnit" defaultValue={initial.priceUnit === "FLAT" ? "PER_TERM" : initial.priceUnit} className="input w-36" aria-label="Rental period">
                  {RENTAL_UNITS.map(([u, label]) => (
                    <option key={u} value={u}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </Field>

          {(kind === "RENT" || kind === "STORAGE") && (
            <Field label="Deposit ($, optional)" name="deposit" hint="Handled in person — shown to renters so they know upfront.">
              <input id="deposit" name="deposit" inputMode="decimal" defaultValue={initial.deposit} placeholder="50" className="input" />
            </Field>
          )}
        </div>

        {kind === "SUBLET" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="City" name="city">
              <select id="city" name="city" value={city} onChange={(e) => setCity(e.target.value)} className="input">
                {WORK_TERM_CITIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Link to full listing (optional)" name="externalUrl" hint="e.g. the Facebook, Kijiji, or Places4Students post.">
              <input id="externalUrl" name="externalUrl" type="url" defaultValue={initial.externalUrl} placeholder="https://" className="input" />
            </Field>
          </div>
        )}

        <Field
          label={outOfTown ? "Area / neighbourhood" : kind === "SUBLET" ? "Neighbourhood" : kind === "WANTED" ? "Where you'd pick up" : "Pickup area"}
          name="neighbourhood"
          hint={outOfTown ? undefined : "General area only — never post your exact address."}
        >
          {outOfTown ? (
            <input id="neighbourhood" name="neighbourhood" required maxLength={60} defaultValue={initial.neighbourhood} placeholder="e.g. Liberty Village" className="input" />
          ) : (
            <select id="neighbourhood" name="neighbourhood" required defaultValue={(NEIGHBOURHOODS as readonly string[]).includes(initial.neighbourhood) ? initial.neighbourhood : ""} className="input">
              <option value="" disabled>
                Choose…
              </option>
              {NEIGHBOURHOODS.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          )}
        </Field>

        {(isDated || kind === "WANTED") && (
          <div>
            <p className="label">
              {kind === "WANTED" ? "When do you need it? (optional)" : kind === "STORAGE" ? "When can you store things?" : "When is it available?"}
            </p>
            <DateRangeFields
              terms={terms}
              defaultFrom={initial.availableFrom}
              defaultUntil={initial.availableUntil}
              fromLabel={kind === "WANTED" ? "From" : "Available from"}
              untilLabel={kind === "WANTED" ? "Until" : "Available until"}
              required={isDated}
            />
          </div>
        )}

        {kind !== "WANTED" && (
          <div>
            <p className="label">Photos</p>
            <PhotoInput existing={initial.photos} />
          </div>
        )}

        {bundles.length > 0 ? (
          <Field label="Add to one of your move-out bundles?" name="bundleId">
            <select id="bundleId" name="bundleId" defaultValue={initial.bundleId} className="input">
              <option value="">No, post it on its own</option>
              {bundles.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-stone-500">
              Want a different group?{" "}
              <Link href="/bundles/new" className="link">
                Start a new move-out bundle
              </Link>{" "}
              with its own title and date.
            </p>
          </Field>
        ) : (
          kind === "SALE" &&
          !editing && (
            <p className="text-sm text-stone-600">
              Selling several things before you move out?{" "}
              <Link href="/bundles/new" className="link">
                Create a move-out bundle
              </Link>{" "}
              to list them all at once.
            </p>
          )
        )}
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton pendingText={editing ? "Saving…" : "Posting…"}>{editing ? "Save changes" : "Post listing"}</SubmitButton>
        {!editing && <p className="text-xs text-stone-500">Listings stay up for 30 days; you can renew anytime.</p>}
      </div>
    </ActionForm>
  );
}
