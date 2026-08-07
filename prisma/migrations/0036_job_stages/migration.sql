-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "isFinalStage" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "prevStageId" TEXT,
ADD COLUMN     "routeId" TEXT,
ADD COLUMN     "stageName" TEXT,
ADD COLUMN     "stageNo" INTEGER;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_prevStageId_fkey" FOREIGN KEY ("prevStageId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

