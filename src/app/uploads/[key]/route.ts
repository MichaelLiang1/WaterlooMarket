import { readImage } from "@/lib/uploads";

export async function GET(_: Request, ctx: RouteContext<"/uploads/[key]">) {
  const { key } = await ctx.params;
  const image = await readImage(key);
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.contentType,
      // Keys are random and never reused, so the file can be cached forever.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
