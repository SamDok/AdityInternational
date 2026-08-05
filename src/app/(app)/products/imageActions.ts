"use server";

import { revalidatePath } from "next/cache";
import { requireUser, isOwner } from "@/lib/auth";
import { putDesignImage } from "@/lib/designImages";

/**
 * Owner-only batch upload of design photos to the CDN. The client compresses
 * each image and sends small chunks of { code, dataUrl }; this stores each on
 * Vercel Blob and links it to its design. Returns how many saved plus any
 * per-code problems so the caller can show a summary.
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
  if (saved) {
    revalidatePath("/products/all");
    revalidatePath("/orders");
  }
  return { saved, errors };
}
