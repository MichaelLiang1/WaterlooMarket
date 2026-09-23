import { timingSafeEqual } from "node:crypto";
import { runDailyJobs } from "@/lib/jobs";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function handle(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  return Response.json(await runDailyJobs());
}

export { handle as GET, handle as POST };
