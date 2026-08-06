import type { PrismaClient } from "@prisma/client";
import { CATALOGUE_DESIGNS, CATALOGUE_VENDORS } from "@/data/catalogue";

/**
 * Shared, idempotent bulk import of the master design catalogue, split so the
 * app can drive it in small client-side chunks (prepare → slice* → finalize).
 * Running the whole thing in one serverless call risks the function timeout on
 * a large catalogue, so the in-app button walks slices with a progress bar;
 * the CLI (scripts/import-designs.ts) uses runCatalogueImport() to do the same
 * loop in one process. The source rows are bundled in src/data/catalogue.ts so
 * this runs on Vercel with no filesystem access.
 *
 * Rules agreed with the owner:
 *  - second code segment = fabric type -> ProductCategory (created by name)
 *  - all widths 140 cm
 *  - colour: Hand Embroidery -> "Silver"; plain fabrics -> shade number in the
 *    code; Computer Embroidery / Prints / Silk Dupion -> blank
 *  - sourcing: Hand Embroidery + Silk Dupion -> JOB_WORK; everything else -> TRADING
 *  - exclude AI/F codes and raw silk-yarn rows; duplicate codes keep the last row
 *  - kaarigar short-code -> Vendor (design's maker); vendor kind derived from usage
 */

type ColourRule = "SILVER" | "SHADE" | "BLANK";
const CAT: Record<string, { category: string; colour: ColourRule; sourcing: "JOB_WORK" | "TRADING" }> = {
  "BG/T":   { category: "Hand Embroidery",         colour: "SILVER", sourcing: "JOB_WORK" },
  "BG/E":   { category: "Computer Embroidery",     colour: "BLANK",  sourcing: "TRADING" },
  "BG/P":   { category: "Prints",                  colour: "BLANK",  sourcing: "TRADING" },
  "BG/MN":  { category: "Boucle",                  colour: "SHADE",  sourcing: "TRADING" },
  "BG/PT":  { category: "Polyester Taffeta",       colour: "SHADE",  sourcing: "TRADING" },
  "BG/DS":  { category: "Silk Duchess Satin",      colour: "SHADE",  sourcing: "TRADING" },
  "BG/SOR": { category: "Silk Organza",            colour: "SHADE",  sourcing: "TRADING" },
  "BG/PTS": { category: "Polyester Taffeta Satin", colour: "SHADE",  sourcing: "TRADING" },
  "BG/ID":  { category: "Indian Dupion",           colour: "SHADE",  sourcing: "TRADING" },
  "BG/ST":  { category: "Silk Satin",              colour: "SHADE",  sourcing: "TRADING" },
  "BG/CS":  { category: "Carolina Satin",          colour: "SHADE",  sourcing: "TRADING" },
  SILK_DUPION: { category: "Silk Dupion",          colour: "BLANK",  sourcing: "JOB_WORK" },
};

type Classified = { category: string; colour: string | null; sourcing: "JOB_WORK" | "TRADING" };

function isExcluded(code: string): boolean {
  return /^AI\/F/i.test(code) || /silk\s*yarn/i.test(code) || /^lurex/i.test(code);
}

export function classify(code: string): Classified | null {
  if (isExcluded(code)) return null;
  const parts = code.split("/");
  let rule: (typeof CAT)[string] | undefined;
  if (parts[0] === "BG" && parts[1]) rule = CAT["BG/" + parts[1]];
  else if (/^B\s/i.test(code)) rule = CAT.SILK_DUPION;
  else if (/^\d/.test(code)) rule = CAT.SILK_DUPION;
  if (!rule) return null;
  const shade = parts[parts.length - 1];
  const colour = rule.colour === "SILVER" ? "Silver" : rule.colour === "SHADE" ? shade || null : null;
  return { category: rule.category, colour, sourcing: rule.sourcing };
}

function cleanCode(x: string): string {
  const c = (x || "").trim();
  return /^\d+\.0$/.test(c) ? c.slice(0, -2) : c;
}

type Kept = { code: string; category: string; colour: string | null; sourcing: "JOB_WORK" | "TRADING"; cost: number | null; kaarigar: string };

// Deterministic in-memory pass over the bundled rows: de-dupe (keep last),
// classify, drop excluded. Cheap (~a few ms) so each slice call can recompute it.
function computeKept(): { kept: Kept[]; excluded: number; unknown: string[] } {
  const byCode = new Map<string, { cp: string; kaarigar: string }>();
  for (const r of CATALOGUE_DESIGNS) {
    const code = cleanCode(r.code);
    if (code) byCode.set(code, { cp: r.cp, kaarigar: r.kaarigar });
  }
  let excluded = 0;
  const unknown: string[] = [];
  const kept: Kept[] = [];
  for (const [code, r] of byCode) {
    const c = classify(code);
    if (!c) { if (isExcluded(code)) excluded++; else unknown.push(code); continue; }
    const n = parseFloat(r.cp);
    kept.push({ code, category: c.category, colour: c.colour, sourcing: c.sourcing, cost: Number.isFinite(n) ? n : null, kaarigar: r.kaarigar });
  }
  return { kept, excluded, unknown };
}

export type ImportSummary = {
  designs: number;
  excluded: number;
  unknown: string[];
  vendors: number;
  categories: { name: string; count: number }[];
  seconds: number;
};

// Step 1 — create vendors + categories (small, fast) and report how many
// designs there are to process.
export async function prepareCatalogue(prisma: PrismaClient): Promise<{ total: number }> {
  const { kept } = computeKept();
  for (const v of CATALOGUE_VENDORS) {
    if (!v.code) continue;
    await prisma.vendor.upsert({
      where: { code: v.code },
      update: { name: v.name || v.code },
      create: { code: v.code, name: v.name || v.code, currency: "INR" },
    });
  }
  for (const name of new Set(kept.map((k) => k.category))) {
    const existing = await prisma.productCategory.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true } });
    if (!existing) await prisma.productCategory.create({ data: { name } });
  }
  return { total: kept.length };
}

// Step 2 — upsert one slice of designs + their single Product variant.
export async function importCatalogueSlice(prisma: PrismaClient, offset: number, size: number): Promise<{ processed: number }> {
  const { kept } = computeKept();
  const slice = kept.slice(offset, offset + size);
  if (!slice.length) return { processed: 0 };

  const catId = new Map((await prisma.productCategory.findMany({ select: { id: true, name: true } })).map((c) => [c.name.toLowerCase(), c.id]));
  const vendId = new Map(
    (await prisma.vendor.findMany({ where: { code: { not: null } }, select: { id: true, code: true } })).map((v) => [v.code as string, v.id]),
  );

  await prisma.$transaction(
    slice.map((k) =>
      prisma.design.upsert({
        where: { code: k.code },
        update: { categoryId: catId.get(k.category.toLowerCase())!, sourcingType: k.sourcing, vendorId: k.kaarigar ? vendId.get(k.kaarigar) ?? null : null },
        create: { code: k.code, categoryId: catId.get(k.category.toLowerCase())!, sourcingType: k.sourcing, vendorId: k.kaarigar ? vendId.get(k.kaarigar) ?? null : null },
      }),
    ),
  );

  const designs = await prisma.design.findMany({ where: { code: { in: slice.map((k) => k.code) } }, select: { id: true, code: true } });
  const codeToId = new Map(designs.map((d) => [d.code, d.id]));
  const prodByDesign = new Map<string, string>();
  for (const p of await prisma.product.findMany({ where: { designId: { in: designs.map((d) => d.id) } }, select: { id: true, designId: true } })) {
    if (p.designId && !prodByDesign.has(p.designId)) prodByDesign.set(p.designId, p.id);
  }
  const creates: { designId: string; width: string; colour: string | null; costPrice: number | null; currency: string; unit: string; name: string }[] = [];
  const updates: { id: string; data: Record<string, unknown> }[] = [];
  for (const k of slice) {
    const did = codeToId.get(k.code);
    if (!did) continue;
    const name = `${k.code} · 140${k.colour ? " · " + k.colour : ""}`;
    const data = { width: "140", colour: k.colour, costPrice: k.cost, currency: "INR", unit: "mtr", name };
    const pid = prodByDesign.get(did);
    if (pid) updates.push({ id: pid, data });
    else creates.push({ designId: did, ...data });
  }
  if (creates.length) await prisma.product.createMany({ data: creates });
  if (updates.length) await prisma.$transaction(updates.map((u) => prisma.product.update({ where: { id: u.id }, data: u.data })));
  return { processed: slice.length };
}

// Step 3 — derive each vendor's kind from usage and report the summary.
export async function finalizeCatalogue(prisma: PrismaClient): Promise<ImportSummary> {
  const usage = new Map<string, Set<string>>();
  for (const d of await prisma.design.findMany({ where: { vendorId: { not: null } }, select: { vendorId: true, sourcingType: true } })) {
    if (!usage.has(d.vendorId!)) usage.set(d.vendorId!, new Set());
    if (d.sourcingType) usage.get(d.vendorId!)!.add(d.sourcingType);
  }
  for (const [vid, set] of usage) {
    const kind = set.has("JOB_WORK") && set.has("TRADING") ? "BOTH" : set.has("TRADING") ? "SUPPLIER" : "KAARIGAR";
    await prisma.vendor.update({ where: { id: vid }, data: { kind } });
  }
  const { kept, excluded, unknown } = computeKept();
  const byCat = new Map<string, number>();
  for (const k of kept) byCat.set(k.category, (byCat.get(k.category) ?? 0) + 1);
  return {
    designs: kept.length,
    excluded,
    unknown,
    vendors: CATALOGUE_VENDORS.filter((v) => v.code).length,
    categories: [...byCat].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    seconds: 0,
  };
}

// One-shot convenience for the CLI: prepare → all slices → finalize.
export async function runCatalogueImport(prisma: PrismaClient): Promise<ImportSummary> {
  const t0 = Date.now();
  const { total } = await prepareCatalogue(prisma);
  for (let off = 0; off < total; off += 500) await importCatalogueSlice(prisma, off, 500);
  const s = await finalizeCatalogue(prisma);
  return { ...s, seconds: (Date.now() - t0) / 1000 };
}
