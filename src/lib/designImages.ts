import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";

/**
 * Design photo storage on the CDN (Vercel Blob), linked to a design by code.
 *
 * The Blob path is derived from the code and overwrites in place, so
 * re-uploading a design replaces its photo rather than piling up duplicates.
 * The resulting CDN URL is kept in DesignImage.data; the /designs/[id]/image
 * route redirects there, so every existing <img> in the app just works.
 */

// Store already-decoded image bytes for a design (found by code).
async function storeBytes(code: string, buffer: Buffer, contentType: string): Promise<{ ok?: true; error?: string }> {
  const design = await prisma.design.findUnique({ where: { code }, select: { id: true } });
  if (!design) return { error: `no design with code "${code}"` };
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const safe = code.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || design.id;
  let url: string;
  try {
    ({ url } = await put(`designs/${safe}.${ext}`, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
    }));
  } catch (e) {
    return { error: `${code}: storage — ${e instanceof Error ? e.message : "Blob upload failed"}` };
  }
  await prisma.designImage.upsert({
    where: { designId: design.id },
    update: { data: url },
    create: { designId: design.id, data: url },
  });
  return { ok: true };
}

// Store a photo from a client-prepared, compressed data URL (manual upload path).
export async function putDesignImage(code: string, dataUrl: string): Promise<{ ok?: true; error?: string }> {
  const m = /^data:(.+?);base64,(.*)$/s.exec(dataUrl);
  if (!m) return { error: `unreadable image for "${code}"` };
  return storeBytes(code, Buffer.from(m[2], "base64"), m[1]);
}

// Pull a photo straight from Google Drive (public "anyone with link" file) using
// its thumbnail endpoint, which returns a web-sized JPEG — resized, no crop.
// Runs on Vercel (which can reach Drive), not in the sandbox.
export async function putDesignImageFromDrive(code: string, fileId: string, maxWidth = 1400): Promise<{ ok?: true; error?: string }> {
  const url = `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${maxWidth}`;
  let res: Response;
  try {
    res = await fetch(url, { redirect: "follow" });
  } catch {
    return { error: `${code}: could not reach Drive` };
  }
  if (!res.ok) return { error: `${code}: Drive returned ${res.status}` };
  const contentType = res.headers.get("content-type") || "image/jpeg";
  if (!contentType.startsWith("image/")) return { error: `${code}: no image (Drive gave ${contentType})` };
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length < 1024) return { error: `${code}: image unavailable or private` };
  return storeBytes(code, buffer, contentType);
}
