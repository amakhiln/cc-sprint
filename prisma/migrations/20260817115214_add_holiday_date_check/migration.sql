-- Defense-in-depth backstop independent of the app-level check in domain/holiday.ts
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_endDate_check" CHECK ("endDate" >= "startDate");