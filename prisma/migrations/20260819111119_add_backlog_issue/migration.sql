-- CreateTable
CREATE TABLE "BacklogIssue" (
    "id" TEXT NOT NULL,
    "youtrackIssueId" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "assigneeId" TEXT,
    "estimateHours" DOUBLE PRECISION NOT NULL,
    "loggedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "loggedHoursPulledAt" TIMESTAMP(3),

    CONSTRAINT "BacklogIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BacklogIssue_sprintId_idx" ON "BacklogIssue"("sprintId");

-- CreateIndex
CREATE UNIQUE INDEX "BacklogIssue_sprintId_youtrackIssueId_key" ON "BacklogIssue"("sprintId", "youtrackIssueId");

-- AddForeignKey
ALTER TABLE "BacklogIssue" ADD CONSTRAINT "BacklogIssue_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacklogIssue" ADD CONSTRAINT "BacklogIssue_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
