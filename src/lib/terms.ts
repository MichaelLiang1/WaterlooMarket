// Waterloo runs three 4-month terms a year. Presets span the whole term
// (first to last day of the four months), which is how co-op students plan
// move-ins and move-outs.

export type TermSeason = "Winter" | "Spring" | "Fall";

export type Term = {
  season: TermSeason;
  year: number;
  label: string; // "Winter 2027 (Jan–Apr)"
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
};

const SEASONS: { season: TermSeason; startMonth: number; range: string }[] = [
  { season: "Winter", startMonth: 1, range: "Jan–Apr" },
  { season: "Spring", startMonth: 5, range: "May–Aug" },
  { season: "Fall", startMonth: 9, range: "Sep–Dec" },
];

const pad = (n: number) => String(n).padStart(2, "0");

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function termAt(year: number, index: number): Term {
  const { season, startMonth, range } = SEASONS[index];
  const endMonth = startMonth + 3;
  return {
    season,
    year,
    label: `${season} ${year} (${range})`,
    start: `${year}-${pad(startMonth)}-01`,
    end: `${year}-${pad(endMonth)}-${pad(lastDayOfMonth(year, endMonth))}`,
  };
}

/** The term containing `date`, followed by the next `count - 1` terms. */
export function upcomingTerms(date: Date = new Date(), count = 4): Term[] {
  let year = date.getFullYear();
  let index = Math.floor(date.getMonth() / 4);
  const terms: Term[] = [];
  for (let i = 0; i < count; i++) {
    terms.push(termAt(year, index));
    index++;
    if (index === SEASONS.length) {
      index = 0;
      year++;
    }
  }
  return terms;
}

/** The term that starts after the current one: when most co-op moves happen. */
export function nextTerm(date: Date = new Date()): Term {
  return upcomingTerms(date, 2)[1];
}

/** Label a date range with a term name if it matches a term exactly. */
export function termLabelFor(start: string, end: string): string | null {
  const year = Number(start.slice(0, 4));
  for (let i = 0; i < SEASONS.length; i++) {
    const t = termAt(year, i);
    if (t.start === start && t.end === end) return t.label;
  }
  return null;
}
