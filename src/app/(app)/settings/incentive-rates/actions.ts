"use server";

import { prisma } from "@/lib/prisma";
import { requireUser, isOwner } from "@/lib/auth";
import { PREFILL_DRAWBACK_PCT, PREFILL_RODTEP_PCT } from "@/lib/incentives";
import { revalidatePath } from "next/cache";

// Create a rate row for every HSN used in the catalogue that doesn't have one
// yet, prefilled with placeholder rates (unverified) the owner then confirms.
export async function seedIncentiveRates(): Promise<{ added: number } | { error: string }> {
  await requireUser();
  if (!(await isOwner())) return { error: "Only the owner can manage incentive rates." };
  const designs = await prisma.design.findMany({ where: { hsnCode: { not: null } }, select: { hsnCode: true }, distinct: ["hsnCode"] });
  const codes = [...new Set(designs.map((d) => d.hsnCode!.trim()).filter(Boolean))];
  const existing = new Set((await prisma.hsnIncentiveRate.findMany({ select: { hsnCode: true } })).map((r) => r.hsnCode));
  const toAdd = codes.filter((c) => !existing.has(c));
  if (toAdd.length) {
    await prisma.hsnIncentiveRate.createMany({
      data: toAdd.map((hsnCode) => ({ hsnCode, drawbackPct: PREFILL_DRAWBACK_PCT, rodtepPct: PREFILL_RODTEP_PCT, verified: false })),
    });
  }
  revalidatePath("/settings/incentive-rates");
  return { added: toAdd.length };
}

type RateInput = { id: string; drawbackPct: number | null; drawbackCap: number | null; rodtepPct: number | null; verified: boolean; notes: string | null };

export async function saveIncentiveRates(rows: RateInput[]): Promise<{ ok: true } | { error: string }> {
  await requireUser();
  if (!(await isOwner())) return { error: "Only the owner can manage incentive rates." };
  for (const r of rows) {
    await prisma.hsnIncentiveRate.update({
      where: { id: r.id },
      data: {
        drawbackPct: r.drawbackPct, drawbackCap: r.drawbackCap, rodtepPct: r.rodtepPct,
        verified: r.verified, notes: r.notes || null,
      },
    });
  }
  revalidatePath("/settings/incentive-rates");
  revalidatePath("/incentives");
  return { ok: true };
}
