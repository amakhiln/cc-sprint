-- AlterTable
ALTER TABLE "Sprint" ADD COLUMN     "name" TEXT,
ADD COLUMN     "youtrackSprintId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Sprint_youtrackSprintId_key" ON "Sprint"("youtrackSprintId");
