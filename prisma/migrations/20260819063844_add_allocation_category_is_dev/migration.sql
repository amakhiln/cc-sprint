-- AlterTable
ALTER TABLE "AllocationCategory" ADD COLUMN     "isDev" BOOLEAN NOT NULL DEFAULT false;

-- At most one category may be the Dev one (Prisma's schema DSL has no
-- partial/filtered @@unique syntax, so this is hand-added) -- mirrors
-- Sprint_one_active_idx's pattern.
CREATE UNIQUE INDEX "AllocationCategory_one_dev_idx" ON "AllocationCategory"("isDev") WHERE "isDev" = true;
