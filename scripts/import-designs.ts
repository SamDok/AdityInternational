/**
 * One-time (idempotent) bulk import of the master design catalogue.
 *
 * Reads three CSVs produced from the owner's spreadsheets:
 *   data/designs-source.csv   code,cp,kaarigar,imageUrl
 *   data/kaarigars.csv        code,name
 *   (data/design-images.csv is a by-product for a later image step)
 *
 * Rules (agreed with the owner):
 *   - Second code segment = fabric type -> ProductCategory (created by name).
 *   - All widths = 140 cm.
 *   - Colour: Hand Embroidery -> "Silver"; plain fabrics -> the shade number in the
 *     code (segment after the final "/"); Computer Embroidery / Prints / Silk Dupion -> blank.
 *   - Sourcing: Hand Embroidery + Silk Dupion -> JOB_WORK; everything else -> TRADING.
 *   - Exclude AI/F codes and the raw silk-yarn rows.
 *   - Duplicate codes: keep the last occurrence.
 *   - Kaarigar short-code -> Vendor (set as the design's maker). Vendor.kind is derived
 *     from the sourcing of the designs that use it (JOB_WORK -> KAARIGAR, TRADING ->
 *     SUPPLIER, both -> BOTH).
 *
 * Run:  DATABASE_URL=... npx tsx scripts/import-designs.ts
 * Re-running is safe: designs upsert by code, one Product per design, vendors/categories
 * are found-or-created.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();
const DATA = join(process.cwd(), "data");

// --- tiny CSV reader (handles quoted fields + embedded commas/quotes) -------------
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}
function readCsv(name: string): Record<string, string>[] {
  const grid = parseCsv(readFileSync(join(DATA, name), "utf8")).filter((r) => r.some((c) => c.trim() !== ""));
  const headers = grid[0].map((h) => h.trim());
  return grid.slice(1).map((r) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => (o[h] = (r[i] ?? "").trim()));
    return o;
  });
}

// --- prefix -> { category, colour rule, sourcing } --------------------------------
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

function classify(code: string): Classified | null {
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

const JOB_WORK_CATS = new Set(["Hand Embroidery", "Silk Dupion"]);

async function main() {
  const t0 = Date.now();
  const designRows = readCsv("designs-source.csv");
  const vendorRows = readCsv("kaarigars.csv");

  // ---- 1. Vendors: find-or-create by short-code -----------------------------------
  const vendorId = new Map<string, string>(); // short-code -> id
  for (const v of vendorRows) {
    if (!v.code) continue;
    const rec = await prisma.vendor.upsert({
      where: { code: v.code },
      update: { name: v.name || v.code },
      create: { code: v.code, name: v.name || v.code, currency: "INR" },
    });
    vendorId.set(v.code, rec.id);
  }

  // ---- 2. De-dupe design rows: keep LAST occurrence per code ----------------------
  const byCode = new Map<string, { cp: string; kaarigar: string }>();
  let excluded = 0;
  const unknown: string[] = [];
  const kept: { code: string; c: Classified; cost: number | null; kaarigar: string }[] = [];
  for (const r of designRows) {
    const code = r.code.trim();
    if (!code) continue;
    byCode.set(code, { cp: r.cp, kaarigar: r.kaarigar }); // last wins
  }
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

  // ---- 3. Categories: find-or-create by name (case-insensitive) -------------------
  const catId = new Map<string, string>();
  for (const name of new Set(kept.map((k) => k.c.category))) {
    const existing = await prisma.productCategory.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true } });
    const id = existing?.id ?? (await prisma.productCategory.create({ data: { name } })).id;
    catId.set(name, id);
  }

  // ---- 4. Designs: upsert by code (batched in transactions) -----------------------
  const CHUNK = 200;
  for (let i = 0; i < kept.length; i += CHUNK) {
    const slice = kept.slice(i, i + CHUNK);
    await prisma.$transaction(
      slice.map((k) =>
        prisma.design.upsert({
          where: { code: k.code },
          update: {
            categoryId: catId.get(k.c.category)!,
            sourcingType: k.c.sourcing,
            vendorId: k.kaarigar ? vendorId.get(k.kaarigar) ?? null : null,
          },
          create: {
            code: k.code,
            categoryId: catId.get(k.c.category)!,
            sourcingType: k.c.sourcing,
            vendorId: k.kaarigar ? vendorId.get(k.kaarigar) ?? null : null,
          },
        }),
      ),
    );
  }

  // ---- 5. One Product per design (width 140, colour, cost) ------------------------
  const codeToId = new Map((await prisma.design.findMany({ select: { id: true, code: true } })).map((d) => [d.code, d.id]));
  const keptIds = kept.map((k) => codeToId.get(k.code)!).filter(Boolean);
  const prodByDesign = new Map<string, string>();
  for (const p of await prisma.product.findMany({ where: { designId: { in: keptIds } }, select: { id: true, designId: true } })) {
    if (p.designId && !prodByDesign.has(p.designId)) prodByDesign.set(p.designId, p.id);
  }
  const creates: any[] = [];
  const updates: { id: string; data: any }[] = [];
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

  // ---- 6. Derive each vendor's kind from its designs' sourcing --------------------
  const usage = new Map<string, Set<string>>();
  for (const d of await prisma.design.findMany({ where: { vendorId: { not: null } }, select: { vendorId: true, sourcingType: true } })) {
    if (!usage.has(d.vendorId!)) usage.set(d.vendorId!, new Set());
    if (d.sourcingType) usage.get(d.vendorId!)!.add(d.sourcingType);
  }
  for (const [vid, set] of usage) {
    const kind = set.has("JOB_WORK") && set.has("TRADING") ? "BOTH" : set.has("TRADING") ? "SUPPLIER" : "KAARIGAR";
    await prisma.vendor.update({ where: { id: vid }, data: { kind } });
  }

  // ---- report --------------------------------------------------------------------
  const byCat = new Map<string, number>();
  for (const k of kept) byCat.set(k.c.category, (byCat.get(k.c.category) ?? 0) + 1);
  console.log(`Imported ${kept.length} designs in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`Excluded (AI/F + yarn): ${excluded}   Unknown prefix (skipped): ${unknown.length}`);
  if (unknown.length) console.log("  unknown:", unknown.slice(0, 20).join(", "));
  console.log("Categories:");
  for (const [c, n] of [...byCat].sort((a, b) => b[1] - a[1])) console.log(`  ${c.padEnd(26)} ${n}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
