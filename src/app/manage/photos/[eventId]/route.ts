import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { tapPhotos } from "@/db/schema";
import { currentManager } from "@/server/auth";

/** A tap photo, only for seniors of the business that owns it. */
export async function GET(_req: Request, ctx: { params: Promise<{ eventId: string }> }) {
  const manager = await currentManager();
  if (!manager) return new Response("Unauthorized", { status: 401 });
  const { eventId } = await ctx.params;
  if (!z.string().uuid().safeParse(eventId).success) return new Response("Not found", { status: 404 });

  const [photo] = await db
    .select({ data: tapPhotos.data, mimeType: tapPhotos.mimeType })
    .from(tapPhotos)
    .where(and(eq(tapPhotos.eventId, eventId), eq(tapPhotos.businessId, manager.business.id)));
  if (!photo) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.mimeType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
