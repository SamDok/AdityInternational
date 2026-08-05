-- Move Design.imageData into a separate 1:1 DesignImage table so design rows
-- stay lean. Order matters: create the table, COPY existing images across, then
-- drop the old column — nothing is lost.

-- CreateTable
CREATE TABLE "DesignImage" (
    "designId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignImage_pkey" PRIMARY KEY ("designId")
);

-- AddForeignKey
ALTER TABLE "DesignImage" ADD CONSTRAINT "DesignImage_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Copy existing photos across before dropping the column.
INSERT INTO "DesignImage" ("designId", "data", "updatedAt")
SELECT "id", "imageData", CURRENT_TIMESTAMP FROM "Design" WHERE "imageData" IS NOT NULL;

-- AlterTable
ALTER TABLE "Design" DROP COLUMN "imageData";
