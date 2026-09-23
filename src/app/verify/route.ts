import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { consumeEmailToken, isAdminEmail } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const userId = await consumeEmailToken(token, "VERIFY_EMAIL");
  if (!userId) redirect("/verify-email?invalid=1");
  const user = await db.user.update({
    where: { id: userId },
    data: { emailVerifiedAt: new Date() },
  });
  if (isAdminEmail(user.email) && user.role !== "ADMIN") {
    await db.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  }
  redirect("/?verified=1");
}
