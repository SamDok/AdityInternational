import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";

/**
 * Store one design's photo on the CDN (Vercel Blob) and link it to the design
 * by code. `dataUrl` is an already-compressed image data URL prepared on the
 * client (aspect ratio preserved — never cropped).
 *
 * The Blob path is derived from the code and overwrites in place, so
 * re-uploading a design replaces its photo rather than piling up duplicates.
 * The resulting CDN URL is kept in DesignImage.data; the /designs/[id]/image
 * route redirects there, so every existing <img> in the app just works.
 */
export async function putDesignImage(code: string, dataUrl: string): Promise<{ ok?: true; error?: string }> {
  const design = await prisma.design.findUnique({ where: { code }, select: { id: true } });
  if (!design) return { error: `no design with code "${code}"` };

  const m = /^data:(.+?);base64,(.*)$/s.exec(dataUrl);
  if (!m) return { error: `unreadable image for "${code}"` };
  const contentType = m[1];
  const buffer = Buffer.from(m[2], "base64");
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const safe = code.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || design.id;

  const { url } = await put(`designs/${safe}.${ext}`, buffer, {
    access: "public",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  await prisma.designImage.upsert({
    where: { designId: design.id },
    update: { data: url },
    create: { designId: design.id, data: url },
  });
  return { ok: true };
}
