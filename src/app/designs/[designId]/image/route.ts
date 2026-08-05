import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// Serves a single design's photo as real image bytes, so the visual gallery can
// lazy-load thumbnails one at a time (only what's on screen) instead of shipping
// every design's base64 in one payload — essential with thousands of designs.
export async function GET(_req: Request, { params }: { params: Promise<{ designId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { designId } = await params;
  const design = await prisma.design.findUnique({ where: { id: designId }, select: { imageData: true } });
  if (!design?.imageData) return new Response("Not found", { status: 404 });

  // Stored as a data URL, e.g. "data:image/jpeg;base64,…".
  const m = /^data:(.+?);base64,(.*)$/s.exec(design.imageData);
  if (!m) return new Response("Unsupported", { status: 415 });

  const bytes = Buffer.from(m[2], "base64");
  return new Response(bytes, {
    headers: {
      "Content-Type": m[1],
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
