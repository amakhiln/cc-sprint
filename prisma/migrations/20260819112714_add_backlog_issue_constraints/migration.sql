-- CreateIndex
CREATE INDEX "BacklogIssue_assigneeId_idx" ON "BacklogIssue"("assigneeId");

-- DB-level backstop for the app-level positive-estimate check in
-- domain/backlog-issue.ts's pullBacklogIssue.
ALTER TABLE "BacklogIssue" ADD CONSTRAINT "BacklogIssue_estimateHours_check" CHECK ("estimateHours" > 0);
