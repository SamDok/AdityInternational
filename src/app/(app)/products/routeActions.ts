"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

export type RouteStepInput = {
  name: string;
  vendorId?: string | null;
  unit?: string | null;
  ratioFromPrev?: number | null;
  rate?: number | null;
};

// Sanitise the client's step list into ordered, valid rows.
function cleanSteps(steps: RouteStepInput[]) {
  return steps
    .filter((s) => s.name && s.name.trim())
    .map((s, i) => ({
      seq: i + 1,
      name: s.name.trim(),
      vendorId: s.vendorId || null,
      unit: (s.unit || "mtr").trim() || "mtr",
      // The first step has no previous step to convert from.
      ratioFromPrev: i === 0 ? null : (s.ratioFromPrev && s.ratioFromPrev > 0 ? s.ratioFromPrev : null),
      rate: s.rate != null && s.rate >= 0 ? s.rate : null,
    }));
}

// Replace a fabric type's default production route.
export async function setCategoryRoute(categoryId: string, steps: RouteStepInput[]) {
  await requireUser();
  const rows = cleanSteps(steps);
  await prisma.$transaction([
    prisma.routeStep.deleteMany({ where: { categoryId } }),
    ...(rows.length ? [prisma.routeStep.createMany({ data: rows.map((r) => ({ categoryId, ...r })) })] : []),
  ]);
  revalidatePath("/products/manage-types");
  return { ok: true };
}

// Replace one design's route override (empty = fall back to the type's route).
export async function setDesignRoute(designId: string, steps: RouteStepInput[]) {
  await requireUser();
  const rows = cleanSteps(steps);
  await prisma.$transaction([
    prisma.routeStep.deleteMany({ where: { designId } }),
    ...(rows.length ? [prisma.routeStep.createMany({ data: rows.map((r) => ({ designId, ...r })) })] : []),
  ]);
  revalidatePath(`/products/design/${designId}`);
  return { ok: true };
}
