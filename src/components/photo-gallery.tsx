"use client";

import { useState } from "react";

export function PhotoGallery({ urls, alt }: { urls: string[]; alt: string }) {
  const [index, setIndex] = useState(0);
  if (urls.length === 0) {
    return (
      <div className="grid aspect-[4/3] place-items-center rounded-xl bg-stone-100 text-sm text-stone-400">
        No photos
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-stone-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={urls[index]} alt={alt} className="size-full object-contain" />
        {urls.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + urls.length) % urls.length)}
              className="absolute top-1/2 left-2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/80 text-lg"
              aria-label="Previous photo"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % urls.length)}
              className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/80 text-lg"
              aria-label="Next photo"
            >
              ›
            </button>
            <span className="absolute right-2 bottom-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
              {index + 1} / {urls.length}
            </span>
          </>
        )}
      </div>
      {urls.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {urls.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setIndex(i)}
              className={`size-16 shrink-0 overflow-hidden rounded-lg border-2 ${i === index ? "border-gold-500" : "border-transparent"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
