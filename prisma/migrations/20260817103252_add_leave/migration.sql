-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('planned', 'emergency');

-- CreateTable
CREATE TABLE "Leave" (
    "id" TEXT NOT NULL,
    "teamMemberId" TEXT NOT NULL,
    "type" "LeaveType" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,

    CONSTRAINT "Leave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Leave_teamMemberId_idx" ON "Leave"("teamMemberId");

-- AddForeignKey
ALTER TABLE "Leave" ADD CONSTRAINT "Leave_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
