#!/usr/bin/env python3
"""Regenerate src/data/catalogue.ts from the CSV extracts in data/."""
import csv, json, os
def rows(p):
    with open(p) as f: return list(csv.DictReader(f))
designs=[{"code":r["code"],"cp":r["cp"],"kaarigar":r["kaarigar"]} for r in rows("data/designs-source.csv")]
vendors=[{"code":r["code"],"name":r["name"]} for r in rows("data/kaarigars.csv")]
with open("src/data/catalogue.ts","w") as f:
    f.write("// AUTO-GENERATED from data/designs-source.csv + data/kaarigars.csv.\n")
    f.write("// Regenerate with: python3 scripts/gen-catalogue.py  (do not hand-edit).\n")
    f.write("export type RawDesign = { code: string; cp: string; kaarigar: string };\n")
    f.write("export type RawVendor = { code: string; name: string };\n\n")
    f.write("export const CATALOGUE_DESIGNS: RawDesign[] = "+json.dumps(designs, ensure_ascii=False)+";\n\n")
    f.write("export const CATALOGUE_VENDORS: RawVendor[] = "+json.dumps(vendors, ensure_ascii=False)+";\n")
print("wrote src/data/catalogue.ts:", len(designs), "designs,", len(vendors), "vendors")
