import { prisma } from "@/lib/prisma";

export type RouteStepDef = {
  seq: number;
  name: string;
  vendorId: string | null;
  vendorName: string | null;
  unit: string;
  ratioFromPrev: number | null; // this step's output units per 1 unit of the previous step
  rate: number | null;
};

// The production route a design flows through: its own steps if any are set,
// otherwise its fabric-type's default route. Ordered first → last (the last
// step's output is the finished, sellable goods). Empty = a plain single-job
// design (no intermediary), which is the common case.
export async function routeForDesign(designId: string): Promise<RouteStepDef[]> {
  const design = await prisma.design.findUnique({
    where: { id: designId },
    select: {
      categoryId: true,
      routeSteps: { include: { vendor: { select: { name: true } } }, orderBy: { seq: "asc" } },
    },
  });
  if (!design) return [];

  const rows =
    design.routeSteps.length > 0
      ? design.routeSteps
      : await prisma.routeStep.findMany({
          where: { categoryId: design.categoryId },
          include: { vendor: { select: { name: true } } },
          orderBy: { seq: "asc" },
        });

  return rows.map((r) => ({
    seq: r.seq,
    name: r.name,
    vendorId: r.vendorId,
    vendorName: r.vendor?.name ?? null,
    unit: r.unit,
    ratioFromPrev: r.ratioFromPrev,
    rate: r.rate,
  }));
}

// How many finished (last-step) units come out of 1 unit of the first step —
// the product of every step-to-step conversion ratio. Used to work backwards
// from a finished order quantity to the yarn/first-step quantity to issue.
// e.g. dupion [Dye(kg), Weave(mtr, ×3)] → 3, so 60 mtr ÷ 3 = 20 kg of yarn.
export function effectiveRatio(steps: RouteStepDef[]): number {
  let r = 1;
  for (let i = 1; i < steps.length; i++) {
    const step = steps[i];
    if (step.ratioFromPrev && step.ratioFromPrev > 0) r *= step.ratioFromPrev;
  }
  return r > 0 ? r : 1;
}

// How many finished units come from 1 unit of the given stage's output — the
// product of the conversion ratios for every step AFTER it. So a job at stage 1
// (the dyer, in kg) converts by the whole chain, and the final stage by 1. Lets
// a job's quantity, whatever stage/unit it's in, be expressed in finished units.
export function ratioToFinished(steps: RouteStepDef[], stageNo: number | null): number {
  const from = stageNo ?? 1;
  let r = 1;
  for (const s of steps) if (s.seq > from && s.ratioFromPrev && s.ratioFromPrev > 0) r *= s.ratioFromPrev;
  return r > 0 ? r : 1;
}
