"use client";

import { useState } from "react";
import type { Term } from "@/lib/terms";
import { Field } from "./forms";

/**
 * Start/end date inputs with one-tap Waterloo term presets
 * ("Winter 2027 (Jan–Apr)"). Presets are clamped to [min, max] if given.
 */
export function DateRangeFields({
  terms,
  fromName = "availableFrom",
  untilName = "availableUntil",
  fromLabel = "Available from",
  untilLabel = "Available until",
  defaultFrom = "",
  defaultUntil = "",
  min,
  max,
  required,
}: {
  terms: Term[];
  fromName?: string;
  untilName?: string;
  fromLabel?: string;
  untilLabel?: string;
  defaultFrom?: string;
  defaultUntil?: string;
  min?: string;
  max?: string;
  required?: boolean;
}) {
  const [from, setFrom] = useState(defaultFrom);
  const [until, setUntil] = useState(defaultUntil);

  const clamp = (d: string) => {
    if (min && d < min) return min;
    if (max && d > max) return max;
    return d;
  };
  const presets = terms.filter((t) => (!max || t.start <= max) && (!min || t.end >= min));

  return (
    <div className="space-y-2">
      {presets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {presets.map((t) => {
            const active = from === clamp(t.start) && until === clamp(t.end);
            return (
              <button
                key={t.label}
                type="button"
                onClick={() => {
                  setFrom(clamp(t.start));
                  setUntil(clamp(t.end));
                }}
                className={`rounded-full border px-3 py-1 text-xs ${active ? "border-ink bg-ink text-white" : "border-stone-300 bg-white hover:bg-stone-100"}`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label={fromLabel} name={fromName}>
          <input
            id={fromName}
            name={fromName}
            type="date"
            className="input"
            value={from}
            min={min}
            max={max}
            required={required}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label={untilLabel} name={untilName}>
          <input
            id={untilName}
            name={untilName}
            type="date"
            className="input"
            value={until}
            min={from || min}
            max={max}
            required={required}
            onChange={(e) => setUntil(e.target.value)}
          />
        </Field>
      </div>
    </div>
  );
}
