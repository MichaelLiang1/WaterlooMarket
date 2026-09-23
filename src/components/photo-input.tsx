"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_PHOTO_BYTES, MAX_PHOTOS } from "@/lib/constants";
import { shrinkImage } from "@/lib/shrink-image";
import { FieldError } from "./forms";

type Existing = { id: string; url: string };

/**
 * Multi-photo picker with previews. New files are submitted under `name`;
 * existing photos the user removes are submitted as `removePhoto` ids.
 */
export function PhotoInput({
  name = "photos",
  existing = [],
  max = MAX_PHOTOS,
}: {
  name?: string;
  existing?: Existing[];
  max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<{ url: string; name: string }[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [warning, setWarning] = useState("");
  const [processing, setProcessing] = useState(false);
  const latestRun = useRef(0);

  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  const kept = existing.filter((p) => !removed.includes(p.id));
  const remaining = max - kept.length;

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const run = ++latestRun.current;
    const picked = [...(input.files ?? [])];
    setProcessing(picked.length > 0);
    const files = await Promise.all(picked.map(shrinkImage));
    // Ignore this result if the user picked again while we were shrinking.
    if (run !== latestRun.current) return;
    setProcessing(false);
    // Swap the shrunk versions into the input so they're what gets submitted.
    const transfer = new DataTransfer();
    files.forEach((f) => transfer.items.add(f));
    input.files = transfer.files;

    const tooBig = files.filter((f) => f.size > MAX_PHOTO_BYTES);
    if (files.length > remaining) {
      setWarning(`You can add ${remaining} more photo${remaining === 1 ? "" : "s"}.`);
    } else if (tooBig.length) {
      setWarning(`${tooBig.map((f) => f.name).join(", ")} ${tooBig.length === 1 ? "is" : "are"} over 5 MB.`);
    } else {
      setWarning("");
    }
    setPreviews(files.map((f) => ({ url: URL.createObjectURL(f), name: f.name })));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {kept.map((p) => (
          <div key={p.id} className="relative size-20 overflow-hidden rounded-lg border border-stone-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="size-full object-cover" />
            <button
              type="button"
              onClick={() => setRemoved((r) => [...r, p.id])}
              className="absolute top-0.5 right-0.5 grid size-5 place-items-center rounded-full bg-black/70 text-xs text-white"
              aria-label="Remove photo"
            >
              ×
            </button>
          </div>
        ))}
        {previews.map((p) => (
          <div key={p.url} className="size-20 overflow-hidden rounded-lg border-2 border-gold-400">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.name} className="size-full object-cover" />
          </div>
        ))}
        {remaining > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="grid size-20 place-items-center rounded-lg border-2 border-dashed border-stone-300 text-2xl text-stone-400 hover:border-gold-500 hover:text-gold-600"
            aria-label="Add photos"
          >
            +
          </button>
        )}
      </div>
      {removed.map((id) => (
        <input key={id} type="hidden" name="removePhoto" value={id} />
      ))}
      <input
        ref={inputRef}
        type="file"
        name={name}
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={onChange}
      />
      <p className="mt-1 text-xs text-stone-500">
        {processing
          ? "Preparing photos…"
          : `Up to ${max} photos (JPEG, PNG, or WebP). Large photos are shrunk automatically.${previews.length > 0 ? " Tap + again to replace your selection." : ""}`}
      </p>
      {warning && <p className="mt-1 text-xs text-red-700">{warning}</p>}
      <FieldError name={name} />
    </div>
  );
}
