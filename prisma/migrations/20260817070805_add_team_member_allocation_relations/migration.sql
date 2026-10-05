-- CreateIndex
CREATE INDEX "TeamMemberAllocation_categoryId_idx" ON "TeamMemberAllocation"("categoryId");

-- AddForeignKey
ALTER TABLE "TeamMemberAllocation" ADD CONSTRAINT "TeamMemberAllocation_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMemberAllocation" ADD CONSTRAINT "TeamMemberAllocation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AllocationCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
