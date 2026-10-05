import type { AllocationCategoryRepo } from "@/domain/allocation";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/infrastructure/db/client";

export const allocationCategoryRepository: AllocationCategoryRepo = {
  create(data) {
    return prisma.allocationCategory.create({ data });
  },
  list() {
    return prisma.allocationCategory.findMany({
      orderBy: { name: "asc" },
    });
  },
  async rename(id, name) {
    try {
      return await prisma.allocationCategory.update({ where: { id }, data: { name } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        // Record to update does not exist -- unknown id, rejected the same
        // way as remove's unknown-id case rather than an unhandled throw.
        return null;
      }
      throw error;
    }
  },
  async remove(id) {
    try {
      return await prisma.allocationCategory.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        // Record to delete does not exist -- unknown id, rejected the same
        // way as a rename of an unknown id rather than an unhandled throw.
        return null;
      }
      throw error;
    }
  },
  async setDev(id) {
    try {
      // Unset whichever category currently holds isDev (if any) before
      // setting the new one, so the two statements never both see a true
      // row at once. The at-most-one guarantee itself comes from the
      // partial unique index (AllocationCategory_one_dev_idx), not from
      // this transaction -- READ COMMITTED doesn't serialize against a
      // concurrent setDev call, the DB constraint is the real backstop.
      const [, updated] = await prisma.$transaction([
        prisma.allocationCategory.updateMany({ where: { isDev: true }, data: { isDev: false } }),
        prisma.allocationCategory.update({ where: { id }, data: { isDev: true } }),
      ]);
      return updated;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        // Record to update does not exist -- unknown id, rejected the same
        // way as rename/remove's unknown-id case.
        return null;
      }
      throw error;
    }
  },
  async unsetDev(id) {
    try {
      return await prisma.allocationCategory.update({ where: { id }, data: { isDev: false } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        return null;
      }
      throw error;
    }
  },
};
