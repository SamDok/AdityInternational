/**
 * CLI rehearsal for the master design catalogue import.
 *
 * Runs the SAME logic as the in-app owner action (src/lib/catalogueImport.ts)
 * against whatever DATABASE_URL you point it at — used to verify locally before
 * loading production via the in-app "Import catalogue" button.
 *
 *   DATABASE_URL=... npx tsx scripts/import-designs.ts
 *
 * Re-running is safe (idempotent).
 */
import { PrismaClient } from "@prisma/client";
import { runCatalogueImport } from "../src/lib/catalogueImport";

const prisma = new PrismaClient();

runCatalogueImport(prisma)
  .then((s) => {
    console.log(`Imported ${s.designs} designs in ${s.seconds.toFixed(1)}s`);
    console.log(`Excluded (AI/F + yarn): ${s.excluded}   Unknown prefix: ${s.unknown.length}`);
    if (s.unknown.length) console.log("  unknown:", s.unknown.slice(0, 20).join(", "));
    console.log(`Vendors: ${s.vendors}`);
    for (const c of s.categories) console.log(`  ${c.name.padEnd(26)} ${c.count}`);
  })
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
