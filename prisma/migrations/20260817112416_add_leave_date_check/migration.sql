-- Defense-in-depth backstop independent of the app-level check in domain/leave.ts
ALTER TABLE "Leave" ADD CONSTRAINT "Leave_endDate_check" CHECK ("endDate" >= "startDate");
