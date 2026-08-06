#!/usr/bin/env python3
"""Regenerate bundled data modules under src/data/ from the CSV extracts in data/."""
import csv, json, re

def rows(p):
    with open(p) as f: return list(csv.DictReader(f))

def clean(code):
    code = (code or "").strip()
    return code[:-2] if re.match(r'^\d+\.0$', code) else code

# --- catalogue (designs + vendors) ---
designs = [{"code": r["code"], "cp": r["cp"], "kaarigar": r["kaarigar"]} for r in rows("data/designs-source.csv")]
vendors = [{"code": r["code"], "name": r["name"]} for r in rows("data/kaarigars.csv")]
with open("src/data/catalogue.ts", "w") as f:
    f.write("// AUTO-GENERATED from data/designs-source.csv + data/kaarigars.csv.\n")
    f.write("// Regenerate with: python3 scripts/gen-catalogue.py  (do not hand-edit).\n")
    f.write("export type RawDesign = { code: string; cp: string; kaarigar: string };\n")
    f.write("export type RawVendor = { code: string; name: string };\n\n")
    f.write("export const CATALOGUE_DESIGNS: RawDesign[] = " + json.dumps(designs, ensure_ascii=False) + ";\n\n")
    f.write("export const CATALOGUE_VENDORS: RawVendor[] = " + json.dumps(vendors, ensure_ascii=False) + ";\n")

# --- design image file-IDs (code -> Drive fileId), cleaned codes ---
imgs = []
seen = set()
for r in rows("data/design-images.csv"):
    code = clean(r["code"])
    url = r["driveImageUrl"] or ""
    m = re.search(r"/d/([A-Za-z0-9_-]+)", url) or re.search(r"[?&]id=([A-Za-z0-9_-]+)", url)
    if not code or not m: continue
    if code in seen: continue  # keep first; codes are unique after import de-dupe
    seen.add(code)
    imgs.append({"code": code, "fileId": m.group(1)})
with open("src/data/designImages.ts", "w") as f:
    f.write("// AUTO-GENERATED from data/design-images.csv. Regenerate with\n")
    f.write("// python3 scripts/gen-catalogue.py  (do not hand-edit).\n")
    f.write("export type DriveImage = { code: string; fileId: string };\n\n")
    f.write("export const DESIGN_IMAGE_FILE_IDS: DriveImage[] = " + json.dumps(imgs, ensure_ascii=False) + ";\n")

print(f"catalogue.ts: {len(designs)} designs, {len(vendors)} vendors")
print(f"designImages.ts: {len(imgs)} image file-ids")
