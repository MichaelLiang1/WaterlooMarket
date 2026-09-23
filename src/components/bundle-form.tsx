"use client";

import { useState } from "react";
import { createBundle } from "@/app/actions/listings";
import { Category, Condition } from "@/generated/prisma/enums";
import { CATEGORY_LABELS, CONDITION_LABELS, NEIGHBOURHOODS } from "@/lib/constants";
import { ActionForm, Field, FieldError, SubmitButton } from "./forms";
import { PhotoInput } from "./photo-input";

const STARTER_ITEMS = ["Desk", "Desk chair", "Mini fridge", "Lamp"];

export function BundleForm({ defaultMoveOut, minDate }: { defaultMoveOut: string; minDate: string }) {
  // Stable ids so removing a row doesn't shift other rows' field names.
  const [rows, setRows] = useState<number[]>([0, 1]);
  const [nextId, setNextId] = useState(2);

  const addRow = () => {
    setRows((r) => [...r, nextId]);
    setNextId((n) => n + 1);
  };

  return (
    <ActionForm action={createBundle} className="space-y-6">
      <div className="card space-y-4 p-4 sm:p-6">
        <Field label="Bundle title" name="title" hint="Call it whatever you like; buyers see it above your items.">
          <input id="title" name="title" required maxLength={80} placeholder="e.g. Moving out of my Northdale room" className="input" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Move-out date" name="moveOutDate" hint="Buyers see this deadline. Items come down the day after.">
            <input id="moveOutDate" name="moveOutDate" type="date" required min={minDate} defaultValue={defaultMoveOut} className="input" />
          </Field>
          <Field label="Pickup area" name="neighbourhood">
            <select id="neighbourhood" name="neighbourhood" required defaultValue="" className="input">
              <option value="" disabled>
                Choose…
              </option>
              {NEIGHBOURHOODS.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Notes for buyers (optional)" name="description">
          <textarea id="description" name="description" rows={2} maxLength={2000} placeholder="Pickup evenings after 6. Discount if you take 3+ items!" className="input" />
        </Field>
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold">Items</h2>
        <FieldError name="items" />
        {rows.map((id, position) => (
          <fieldset key={id} className="card space-y-3 p-4">
            <div className="flex items-center justify-between">
              <legend className="text-sm font-semibold text-stone-500">Item {position + 1}</legend>
              {rows.length > 1 && (
                <button type="button" onClick={() => setRows((r) => r.filter((x) => x !== id))} className="text-xs text-red-700 hover:underline">
                  Remove
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
              <Field label="What is it?" name={`items.${id}.title`}>
                <input id={`items.${id}.title`} name={`items.${id}.title`} required maxLength={80} placeholder={STARTER_ITEMS[position % STARTER_ITEMS.length]} className="input" />
              </Field>
              <Field label="Category" name={`items.${id}.category`}>
                <select id={`items.${id}.category`} name={`items.${id}.category`} required defaultValue="" className="input">
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
              <Field label="Price ($)" name={`items.${id}.price`}>
                <input id={`items.${id}.price`} name={`items.${id}.price`} required inputMode="decimal" placeholder="25" className="input" />
              </Field>
            </div>
            <Field label="Condition" name={`items.${id}.condition`}>
              <div className="flex max-w-sm gap-2">
                {Object.values(Condition).map((c) => (
                  <label key={c} className="flex-1 cursor-pointer">
                    <input type="radio" name={`items.${id}.condition`} value={c} required defaultChecked={c === "GOOD"} className="peer sr-only" />
                    <span className="block rounded-lg border border-stone-300 py-1.5 text-center text-sm peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white">
                      {CONDITION_LABELS[c]}
                    </span>
                  </label>
                ))}
              </div>
            </Field>
            <details>
              <summary className="cursor-pointer text-sm text-stone-600">Add description & photos</summary>
              <div className="mt-3 space-y-3">
                <textarea name={`items.${id}.description`} rows={2} maxLength={2000} placeholder="Size, brand, any wear…" className="input" />
                <PhotoInput name={`items.${id}.photos`} />
              </div>
            </details>
          </fieldset>
        ))}
        <button type="button" onClick={addRow} className="btn-secondary w-full border-dashed">
          + Add another item
        </button>
      </div>

      <SubmitButton className="btn-gold" pendingText="Posting bundle…">
        Post {rows.length} item{rows.length === 1 ? "" : "s"}
      </SubmitButton>
    </ActionForm>
  );
}
