import { prisma } from "./prisma";

export type MaterialMove = {
  materialId: string;
  delta: number; // + in / - out
  reason: "PURCHASE" | "ISSUE_TO_JOB" | "RETURN_FROM_JOB" | "MANUAL_ADJUST";
  jobId?: string | null;
  materialPoId?: string | null;
  userId?: string | null;
  note?: string | null;
};

// Apply a batch of raw-material stock changes and log each as a movement, in one
// transaction. Mirrors applyMovements in src/lib/stock.ts. Raw increments, so
// stock can go negative (issue more than on hand) and returns stay symmetric.
export async function applyMaterialMovements(moves: MaterialMove[]) {
  const ops = [];
  for (const m of moves) {
    if (!m.delta) continue;
    ops.push(
      prisma.rawMaterial.update({ where: { id: m.materialId }, data: { stockQty: { increment: m.delta } } }),
      prisma.rawMaterialMovement.create({
        data: {
          materialId: m.materialId,
          delta: m.delta,
          reason: m.reason,
          jobId: m.jobId ?? null,
          materialPoId: m.materialPoId ?? null,
          userId: m.userId ?? null,
          note: m.note ?? null,
        },
      }),
    );
  }
  if (ops.length) await prisma.$transaction(ops);
}

// Next "RM-001" style code (max existing + 1).
export async function nextMaterialCode(): Promise<string> {
  const rows = await prisma.rawMaterial.findMany({ where: { code: { startsWith: "RM-" } }, select: { code: true } });
  let max = 0;
  for (const r of rows) {
    const n = parseInt((r.code ?? "").slice(3), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `RM-${String(max + 1).padStart(3, "0")}`;
}

export type MaterialDefault = { materialId: string; name: string; unit: string; kind: string; qtyPerPiece: number | null };

// The materials a design normally uses: its own overrides if any, else its
// fabric-type defaults. Powers the pre-filled issue form so the owner never has
// to remember which materials a design needs.
export async function defaultMaterialsForDesign(designId: string): Promise<MaterialDefault[]> {
  const design = await prisma.design.findUnique({
    where: { id: designId },
    select: {
      categoryId: true,
      materialOverrides: { include: { material: { select: { id: true, name: true, unit: true, kind: true } } } },
    },
  });
  if (!design) return [];

  const rows =
    design.materialOverrides.length > 0
      ? design.materialOverrides
      : await prisma.categoryMaterial.findMany({
          where: { categoryId: design.categoryId },
          include: { material: { select: { id: true, name: true, unit: true, kind: true } } },
        });

  return rows
    .filter((r) => !!r.material)
    .map((r) => ({
      materialId: r.material.id,
      name: r.material.name,
      unit: r.material.unit,
      kind: r.material.kind,
      qtyPerPiece: r.qtyPerPiece ?? null,
    }));
}
