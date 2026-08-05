import type { PrismaClient } from "@prisma/client";
import { CATALOGUE_DESIGNS, CATALOGUE_VENDORS } from "@/data/catalogue";

/**
 * Shared, idempotent bulk import of the master design catalogue.
 *
 * Used by both the owner-only in-app action (src/app/(app)/settings/actions.ts)
 * and the CLI rehearsal (scripts/import-designs.ts). The source rows are bundled
 * in src/data/catalogue.ts so this runs on Vercel with no filesystem access.
 *
 * Rules agreed with the owner:
 *  - second code segment = fabric type -> ProductCategory (created by name)
 *  - all widths 140 cm
 *  - colour: Hand Embroidery -> "Silver"; plain fabrics -> shade number in the code;
 *    Computer Embroidery / Prints / Silk Dupion -> blank
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

export function classify(code: string): Classified | null {
  if (/^AI\/F/i.test(code)) return null; // owner: do not import
  if (/silk\s*yarn/i.test(code) || /^lurex/i.test(code)) return null; // raw yarn rows
  const parts = code.split("/");
  let rule: (typeof CAT)[string] | undefined;
  if (parts[0] === "BG" && parts[1]) rule = CAT["BG/" + parts[1]];
  else if (/^B\s/i.test(code)) rule = CAT.SILK_DUPION;
  else if (/^\d/.test(code)) rule = CAT.SILK_DUPION;
  if (!rule) return null; // unknown prefix -> skip (reported)
  const shade = parts[parts.length - 1];
  const colour = rule.colour === "SILVER" ? "Silver" : rule.colour === "SHADE" ? shade || null : null;
  return { category: rule.category, colour, sourcing: rule.sourcing };
}

function cleanCode(x: string): string {
  const c = (x || "").trim();
  return /^\d+\.0$/.test(c) ? c.slice(0, -2) : c;
}

export type ImportSummary = {
  designs: number;
  excluded: number;
  unknown: string[];
  vendors: number;
  categories: { name: string; count: number }[];
  seconds: number;
};

export async function runCatalogueImport(prisma: PrismaClient): Promise<ImportSummary> {
  const t0 = Date.now();

  // 1. Vendors: find-or-create by short-code.
  const vendorId = new Map<string, string>();
  for (const v of CATALOGUE_VENDORS) {
    if (!v.code) continue;
    const rec = await prisma.vendor.upsert({
      where: { code: v.code },
      update: { name: v.name || v.code },
      create: { code: v.code, name: v.name || v.code, currency: "INR" },
    });
    vendorId.set(v.code, rec.id);
  }

  // 2. De-dupe design rows (keep last occurrence per code) + classify.
  const byCode = new Map<string, { cp: string; kaarigar: string }>();
  for (const r of CATALOGUE_DESIGNS) {
    const code = cleanCode(r.code);
    if (code) byCode.set(code, { cp: r.cp, kaarigar: r.kaarigar });
  }
  let excluded = 0;
  const unknown: string[] = [];
  const kept: { code: string; c: Classified; cost: number | null; kaarigar: string }[] = [];
  for (const [code, r] of byCode) {
    const c = classify(code);
    if (!c) {
      if (/^AI\/F/i.test(code) || /silk\s*yarn/i.test(code) || /^lurex/i.test(code)) excluded++;
      else unknown.push(code);
      continue;
    }
    const n = parseFloat(r.cp);
    kept.push({ code, c, cost: Number.isFinite(n) ? n : null, kaarigar: r.kaarigar });
  }

  // 3. Categories: find-or-create by name (case-insensitive).
  const catId = new Map<string, string>();
  for (const name of new Set(kept.map((k) => k.c.category))) {
    const existing = await prisma.productCategory.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true } });
    const id = existing?.id ?? (await prisma.productCategory.create({ data: { name } })).id;
    catId.set(name, id);
  }

  // 4. Designs: upsert by code, batched in transactions.
  const CHUNK = 200;
  for (let i = 0; i < kept.length; i += CHUNK) {
    await prisma.$transaction(
      kept.slice(i, i + CHUNK).map((k) =>
        prisma.design.upsert({
          where: { code: k.code },
          update: { categoryId: catId.get(k.c.category)!, sourcingType: k.c.sourcing, vendorId: k.kaarigar ? vendorId.get(k.kaarigar) ?? null : null },
          create: { code: k.code, categoryId: catId.get(k.c.category)!, sourcingType: k.c.sourcing, vendorId: k.kaarigar ? vendorId.get(k.kaarigar) ?? null : null },
        }),
      ),
    );
  }

  // 5. One Product per design (width 140, colour, cost).
  const codeToId = new Map((await prisma.design.findMany({ select: { id: true, code: true } })).map((d) => [d.code, d.id]));
  const keptIds = kept.map((k) => codeToId.get(k.code)).filter((x): x is string => Boolean(x));
  const prodByDesign = new Map<string, string>();
  for (const p of await prisma.product.findMany({ where: { designId: { in: keptIds } }, select: { id: true, designId: true } })) {
    if (p.designId && !prodByDesign.has(p.designId)) prodByDesign.set(p.designId, p.id);
  }
  const creates: { designId: string; width: string; colour: string | null; costPrice: number | null; currency: string; unit: string; name: string }[] = [];
  const updates: { id: string; data: Record<string, unknown> }[] = [];
  for (const k of kept) {
    const did = codeToId.get(k.code);
    if (!did) continue;
    const name = `${k.code} · 140${k.c.colour ? " · " + k.c.colour : ""}`;
    const data = { width: "140", colour: k.c.colour, costPrice: k.cost, currency: "INR", unit: "mtr", name };
    const pid = prodByDesign.get(did);
    if (pid) updates.push({ id: pid, data });
    else creates.push({ designId: did, ...data });
  }
  for (let i = 0; i < creates.length; i += 500) await prisma.product.createMany({ data: creates.slice(i, i + 500) });
  for (let i = 0; i < updates.length; i += CHUNK) {
    await prisma.$transaction(updates.slice(i, i + CHUNK).map((u) => prisma.product.update({ where: { id: u.id }, data: u.data })));
  }

  // 6. Derive each vendor's kind from its designs' sourcing.
  const usage = new Map<string, Set<string>>();
  for (const d of await prisma.design.findMany({ where: { vendorId: { not: null } }, select: { vendorId: true, sourcingType: true } })) {
    if (!usage.has(d.vendorId!)) usage.set(d.vendorId!, new Set());
    if (d.sourcingType) usage.get(d.vendorId!)!.add(d.sourcingType);
  }
  for (const [vid, set] of usage) {
    const kind = set.has("JOB_WORK") && set.has("TRADING") ? "BOTH" : set.has("TRADING") ? "SUPPLIER" : "KAARIGAR";
    await prisma.vendor.update({ where: { id: vid }, data: { kind } });
  }

  const byCat = new Map<string, number>();
  for (const k of kept) byCat.set(k.c.category, (byCat.get(k.c.category) ?? 0) + 1);
  return {
    designs: kept.length,
    excluded,
    unknown,
    vendors: vendorId.size,
    categories: [...byCat].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    seconds: (Date.now() - t0) / 1000,
  };
}
