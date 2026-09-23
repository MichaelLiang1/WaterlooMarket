import type { PriceUnit } from "@/generated/prisma/enums";
import { PRICE_UNIT_LABELS } from "./constants";

export function formatPrice(cents: number, unit: PriceUnit = "FLAT") {
  if (cents === 0 && unit === "FLAT") return "Free";
  const dollars = cents / 100;
  const amount = dollars.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: Number.isInteger(dollars) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  const suffix = PRICE_UNIT_LABELS[unit];
  return suffix ? `${amount} ${suffix}` : amount;
}

/** Postgres DATE columns come back as UTC midnight; always render in UTC. */
export function formatDay(date: Date | null | undefined) {
  if (!date) return "";
  return date.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateTime(date: Date) {
  return date.toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Toronto",
  });
}

export function timeAgo(date: Date, now = new Date()) {
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDay(date);
}

/** YYYY-MM-DD for <input type="date"> from a DATE column. */
export function toDateInput(date: Date | null | undefined) {
  return date ? date.toISOString().slice(0, 10) : "";
}

/** Parse YYYY-MM-DD into a UTC-midnight Date suitable for a DATE column. */
export function parseDateInput(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Today in Waterloo as a UTC-midnight Date, for comparing with DATE columns. */
export function todayDate() {
  const ymd = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Toronto",
  });
  return new Date(`${ymd}T00:00:00.000Z`);
}

export function dollarsToCents(value: string | null | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const n = Number(value.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return null;
  return Math.round(n * 100);
}

export function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}
