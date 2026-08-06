import { v2 as cloudinary } from "cloudinary";
import { prisma } from "@/lib/prisma";

/**
 * Design photo storage on Cloudinary (free tier, image-optimised CDN), linked
 * to a design by code. The public_id is derived from the code and overwrites in
 * place, so re-uploading a design replaces its photo rather than duplicating.
 * The delivered URL (with q_auto,f_auto so browsers get an optimised, modern
 * format) is kept in DesignImage.data; the /designs/[id]/image route redirects
 * there, so every existing <img> in the app just works.
 *
 * Needs three env vars: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY,
 * CLOUDINARY_API_SECRET (set in Vercel).
 */

function cloudinaryConfigured(): boolean {
  return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

// Store already-decoded image bytes for a design (found by code).
async function storeBytes(code: string, buffer: Buffer, contentType: string): Promise<{ ok?: true; error?: string }> {
  const design = await prisma.design.findUnique({ where: { code }, select: { id: true } });
  if (!design) return { error: `no design with code "${code}"` };
  if (!cloudinaryConfigured()) return { error: `${code}: image host not set up (add the Cloudinary keys in Vercel)` };

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  const safe = code.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || design.id;
  const dataUri = `data:${contentType};base64,${buffer.toString("base64")}`;
  let url: string;
  try {
    const res = await cloudinary.uploader.upload(dataUri, {
      public_id: safe,
      folder: "aditya-designs",
      overwrite: true,
      resource_type: "image",
    });
    // Serve optimised (auto quality + modern format) via a delivery transform.
    url = res.secure_url.replace("/upload/", "/upload/q_auto,f_auto/");
  } catch (e) {
    return { error: `${code}: storage — ${e instanceof Error ? e.message : "Cloudinary upload failed"}` };
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
export async function putDesignImageFromDrive(code: string, fileId: string, maxWidth = 1000): Promise<{ ok?: true; error?: string }> {
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
