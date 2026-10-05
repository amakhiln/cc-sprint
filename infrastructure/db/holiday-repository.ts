import type { HolidayRepo } from "@/domain/holiday";
import { prisma } from "@/infrastructure/db/client";

export const holidayRepository: HolidayRepo = {
  list() {
    return prisma.holiday.findMany({ orderBy: { startDate: "asc" } });
  },
  create(data) {
    return prisma.holiday.create({ data });
  },
};
