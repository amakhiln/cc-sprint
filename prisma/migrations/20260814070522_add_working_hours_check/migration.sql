-- Defense-in-depth backstop independent of the app-level check in domain/allocation.ts
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_workingHoursPerDay_check" CHECK ("workingHoursPerDay" > 0);
