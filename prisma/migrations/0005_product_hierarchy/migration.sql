-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hsnCode" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Design" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "composition" TEXT,
    "hsnCode" TEXT,
    "description" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Design_pkey" PRIMARY KEY ("id")
);

-- AlterTable (all additive / nullable — existing products & orders untouched)
ALTER TABLE "Product" ADD COLUMN "designId" TEXT;
ALTER TABLE "Product" ADD COLUMN "width" TEXT;
ALTER TABLE "Product" ADD COLUMN "gsm" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN "costPrice" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_name_key" ON "ProductCategory"("name");
CREATE UNIQUE INDEX "Design_code_key" ON "Design"("code");

-- AddForeignKey
ALTER TABLE "Design" ADD CONSTRAINT "Design_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the main product types (idempotent).
INSERT INTO "ProductCategory" ("id", "name", "sortOrder", "createdAt", "updatedAt") VALUES
  ('cat_hand_embroidery',   'Hand Embroidery',          1, now(), now()),
  ('cat_furnishing',        'Furnishing',               2, now(), now()),
  ('cat_silk_dupion',       'Silk Dupion',              3, now(), now()),
  ('cat_boucle',            'Boucle',                   4, now(), now()),
  ('cat_polyester_taffeta', 'Polyester Taffeta',        5, now(), now()),
  ('cat_prints',            'Prints on multiple bases', 6, now(), now()),
  ('cat_silk_organza',      'Silk Organza',             7, now(), now()),
  ('cat_silk_duchess',      'Silk Duchess Satin',       8, now(), now()),
  ('cat_silk_satin',        'Silk Satin',               9, now(), now()),
  ('cat_indian_dupion',     'Indian Dupion',           10, now(), now())
ON CONFLICT ("name") DO NOTHING;
