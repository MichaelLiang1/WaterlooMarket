import { formatDay, todayDate } from "@/lib/format";

type Range = { startDate: Date; endDate: Date };

const DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * Month grids showing which days in the availability window are open vs
 * booked. All dates are UTC-midnight DATE values.
 */
export function AvailabilityCalendar({
  from,
  until,
  booked,
  maxMonths = 4,
}: {
  from: Date;
  until: Date;
  booked: Range[];
  maxMonths?: number;
}) {
  const today = todayDate();
  const start = from > today ? from : today;
  if (start > until) {
    return <p className="text-sm text-stone-600">The availability window has ended.</p>;
  }

  const isBooked = (d: Date) => booked.some((r) => d >= r.startDate && d <= r.endDate);
  const months: Date[] = [];
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cursor <= until && months.length < maxMonths) {
    months.push(cursor);
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        {months.map((month) => {
          const firstWeekday = month.getUTCDay();
          const daysInMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
          return (
            <div key={month.toISOString()}>
              <p className="mb-1 text-sm font-medium">
                {month.toLocaleDateString("en-CA", { month: "long", year: "numeric", timeZone: "UTC" })}
              </p>
              <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
                {WEEKDAYS.map((d, i) => (
                  <span key={i} className="py-0.5 text-stone-400">
                    {d}
                  </span>
                ))}
                {Array.from({ length: firstWeekday }, (_, i) => (
                  <span key={`pad${i}`} />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = new Date(month.getTime() + i * DAY);
                  const inWindow = day >= start && day <= until;
                  const taken = inWindow && isBooked(day);
                  const cls = !inWindow
                    ? "text-stone-300"
                    : taken
                      ? "bg-red-100 text-red-700 line-through"
                      : "bg-emerald-50 text-emerald-800";
                  return (
                    <span key={i} className={`rounded py-1 ${cls}`} title={taken ? "Booked" : inWindow ? "Available" : ""}>
                      {i + 1}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-stone-600">
        <span className="flex items-center gap-1">
          <span className="size-3 rounded bg-emerald-100" /> Available
        </span>
        <span className="flex items-center gap-1">
          <span className="size-3 rounded bg-red-100" /> Booked
        </span>
      </div>
      {booked.length > 0 && (
        <ul className="mt-2 text-xs text-stone-600">
          {booked
            .filter((r) => r.endDate >= today)
            .map((r) => (
              <li key={r.startDate.toISOString()}>
                Booked {formatDay(r.startDate)} – {formatDay(r.endDate)}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
