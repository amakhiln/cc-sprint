// Framework-free business logic. Zero imports from @prisma/client, next, or
// infrastructure/ — see AD-1 in the Architecture Spine.

export type Holiday = {
  id: string;
  startDate: Date;
  endDate: Date;
};

export type HolidayRepo = {
  list(): Promise<Holiday[]>;
  create(data: { startDate: Date; endDate: Date }): Promise<Holiday>;
};

export type RecordHolidayInput = {
  startDate: Date;
  endDate: Date;
};

export type RecordHolidayResult =
  | { ok: true; data: Holiday }
  | { ok: false; error: string };

export async function recordHoliday(
  repo: HolidayRepo,
  input: RecordHolidayInput,
): Promise<RecordHolidayResult> {
  if (!(input.startDate instanceof Date) || Number.isNaN(input.startDate.getTime())) {
    return { ok: false, error: "Start date is required and must be a valid date" };
  }
  if (!(input.endDate instanceof Date) || Number.isNaN(input.endDate.getTime())) {
    return { ok: false, error: "End date is required and must be a valid date" };
  }

  // Inclusive on both ends -- both dates are independently typed by the
  // user here, so this is a real check.
  if (input.endDate.getTime() < input.startDate.getTime()) {
    return { ok: false, error: "End date must be on or after the start date" };
  }

  const data = await repo.create({
    startDate: input.startDate,
    endDate: input.endDate,
  });

  return { ok: true, data };
}
