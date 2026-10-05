-- CreateEnum
CREATE TYPE "SprintStatus" AS ENUM ('active', 'closed');

-- CreateTable
CREATE TABLE "Sprint" (
    "id" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "SprintStatus" NOT NULL DEFAULT 'active',
    "snapshotCapacityHours" INTEGER,
    "snapshotAllocationBreakdown" JSONB,
    "snapshotActualVelocityHours" INTEGER,

    CONSTRAINT "Sprint_pkey" PRIMARY KEY ("id")
);

-- AD-6: at most one active Sprint at a time. Hand-added -- Prisma's schema
-- DSL has no partial/filtered @@unique syntax, so this is the DB-level
-- backstop under domain/sprint.ts's findActive() pre-check.
CREATE UNIQUE INDEX "Sprint_one_active_idx" ON "Sprint"("status") WHERE "status" = 'active';
