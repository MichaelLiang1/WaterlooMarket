/**
 * True if `err` came from Postgres rejecting a write because of the named
 * constraint/index (unique violation 23505 or exclusion violation 23P01).
 * Prisma surfaces these differently depending on the query path, so we check
 * the error and its causes for the constraint name.
 */
export function isConstraintViolation(err: unknown, constraint: string): boolean {
  const seen = new Set<unknown>();
  let current: unknown = err;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const e = current as Record<string, unknown>;
    const haystack = [e.message, e.constraint, JSON.stringify(e.meta ?? "")]
      .filter((v) => typeof v === "string")
      .join(" ");
    if (haystack.includes(constraint)) return true;
    current = e.cause;
  }
  return false;
}
