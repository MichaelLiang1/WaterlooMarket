import { db } from "@/lib/db";

/** Used by the host's health check: 200 only if the app can reach the database. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
