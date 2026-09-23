export type ActionState =
  | {
      error?: string;
      fieldErrors?: Record<string, string>;
      success?: string;
    }
  | undefined;

export function fail(error: string, fieldErrors?: Record<string, string>): ActionState {
  return { error, fieldErrors };
}

export function ok(success: string): ActionState {
  return { success };
}

/** Turn zod issues into { field: firstMessage }. */
export function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
