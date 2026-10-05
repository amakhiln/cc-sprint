-- CreateTable
CREATE TABLE "TeamMemberAllocation" (
    "id" TEXT NOT NULL,
    "teamMemberId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "percent" INTEGER NOT NULL,

    CONSTRAINT "TeamMemberAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamMemberAllocation_teamMemberId_categoryId_key" ON "TeamMemberAllocation"("teamMemberId", "categoryId");
