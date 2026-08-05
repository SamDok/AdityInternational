"use client";

/**
 * Resize an image to fit within `maxDim` on its longest side, preserving the
 * aspect ratio — the whole design is kept, never cropped — and return a
 * compressed JPEG data URL. Used before uploading so we send web-sized photos
 * (originals off a phone can be several MB each).
 */
export async function compressImage(file: File | Blob, maxDim = 1400, quality = 0.82): Promise<string> {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  if (Math.max(width, height) > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) { bitmap.close?.(); throw new Error("Canvas not supported"); }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", quality);
}
