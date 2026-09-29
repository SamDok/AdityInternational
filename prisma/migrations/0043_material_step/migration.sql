-- DropIndex
DROP INDEX "CategoryMaterial_categoryId_materialId_key";

-- DropIndex
DROP INDEX "DesignMaterial_designId_materialId_key";

-- AlterTable
ALTER TABLE "CategoryMaterial" ADD COLUMN     "stepName" TEXT;

-- AlterTable
ALTER TABLE "DesignMaterial" ADD COLUMN     "stepName" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CategoryMaterial_categoryId_materialId_stepName_key" ON "CategoryMaterial"("categoryId", "materialId", "stepName");

-- CreateIndex
CREATE UNIQUE INDEX "DesignMaterial_designId_materialId_stepName_key" ON "DesignMaterial"("designId", "materialId", "stepName");

