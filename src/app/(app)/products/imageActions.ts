"use server";

import { revalidatePath } from "next/cache";
import { requireUser, isOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { putDesignImage, putDesignImageFromDrive } from "@/lib/designImages";

/**
 * Owner-only manual upload: the client compresses each image and sends small
 * chunks of { code, dataUrl }; this stores each on Vercel Blob.
 */
export async function saveDesignImages(
  entries: { code: string; dataUrl: string }[],
): Promise<{ saved: number; errors: string[] }> {
  await requireUser();
  if (!(await isOwner())) return { saved: 0, errors: ["Only the owner can upload design images."] };

  let saved = 0;
  const errors: string[] = [];
  for (const e of entries) {
    try {
      const r = await putDesignImage(e.code, e.dataUrl);
      if (r.ok) saved++;
      else errors.push(`${e.code}: ${r.error}`);
    } catch (err) {
      errors.push(`${e.code}: ${err instanceof Error ? err.message : "upload failed"}`);
    }
  }
  if (saved) { revalidatePath("/products/all"); revalidatePath("/orders"); }
  return { saved, errors };
}

// Run an async mapper over items with a small concurrency cap.
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * Owner-only: pull a batch of design photos straight from Google Drive into the
 * CDN. The client walks the full bundled file-ID list in chunks and shows
 * progress. Idempotent — designs that already have a photo are skipped unless
 * `overwrite` is set, so re-running fills only the gaps.
 */
export async function importDriveImages(
  batch: { code: string; fileId: string }[],
  overwrite = false,
): Promise<{ done: number; skipped: number; errors: string[] }> {
  await requireUser();
  if (!(await isOwner())) return { done: 0, skipped: 0, errors: ["Only the owner can import images."] };

  const existing = new Set<string>();
  if (!overwrite) {
    const withImg = await prisma.design.findMany({
      where: { code: { in: batch.map((b) => b.code) }, image: { isNot: null } },
      select: { code: true },
    });
    for (const d of withImg) existing.add(d.code);
  }

  const todo = batch.filter((b) => !existing.has(b.code));
  const results = await mapLimit(todo, 6, (b) => putDesignImageFromDrive(b.code, b.fileId));

  let done = 0;
  const errors: string[] = [];
  for (const r of results) {
    if (r.ok) done++;
    else if (r.error) errors.push(r.error);
  }
  if (done) { revalidatePath("/products/all"); revalidatePath("/orders"); }
  return { done, skipped: batch.length - todo.length, errors };
}
