// Framework-free business logic. Zero imports from @prisma/client, next, or
// infrastructure/ — see AD-1 in the Architecture Spine.

export type TeamMember = {
  id: string;
  name: string;
  workingHoursPerDay: number;
  archivedAt: Date | null;
};

export type TeamMemberRepo = {
  create(data: { name: string; workingHoursPerDay: number }): Promise<TeamMember>;
  list(): Promise<TeamMember[]>;
  archive(id: string): Promise<TeamMember | null>;
  updateWorkingHours(id: string, workingHoursPerDay: number): Promise<TeamMember | null>;
};

export type AddTeamMemberInput = {
  name: string;
  workingHoursPerDay?: number;
};

export type AddTeamMemberResult =
  | { ok: true; data: TeamMember }
  | { ok: false; error: string };

const DEFAULT_WORKING_HOURS_PER_DAY = 8;
const MAX_NAME_LENGTH = 200;
const MAX_WORKING_HOURS_PER_DAY = 24;

function validateWorkingHoursPerDay(workingHoursPerDay: number): string | { ok: false; error: string } {
  if (
    !Number.isInteger(workingHoursPerDay) ||
    workingHoursPerDay < 1 ||
    workingHoursPerDay > MAX_WORKING_HOURS_PER_DAY
  ) {
    return {
      ok: false,
      error: `Working hours per day must be a whole number between 1 and ${MAX_WORKING_HOURS_PER_DAY}`,
    };
  }
  return "ok";
}

export async function addTeamMember(
  repo: TeamMemberRepo,
  input: AddTeamMemberInput,
): Promise<AddTeamMemberResult> {
  const name = input.name?.trim();
  if (!name) {
    return { ok: false, error: "Name is required" };
  }
  if (name.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `Name must be ${MAX_NAME_LENGTH} characters or fewer` };
  }

  const workingHoursPerDay = input.workingHoursPerDay ?? DEFAULT_WORKING_HOURS_PER_DAY;
  const hoursCheck = validateWorkingHoursPerDay(workingHoursPerDay);
  if (typeof hoursCheck !== "string") {
    return hoursCheck;
  }

  const data = await repo.create({ name, workingHoursPerDay });

  return { ok: true, data };
}

export type UpdateTeamMemberWorkingHoursResult =
  | { ok: true; data: TeamMember }
  | { ok: false; error: string };

export async function updateTeamMemberWorkingHours(
  repo: TeamMemberRepo,
  id: string,
  workingHoursPerDay: number,
): Promise<UpdateTeamMemberWorkingHoursResult> {
  const hoursCheck = validateWorkingHoursPerDay(workingHoursPerDay);
  if (typeof hoursCheck !== "string") {
    return hoursCheck;
  }

  // repo.updateWorkingHours does the "does this id exist" check and the
  // write as one atomic DB operation -- null means unknown id, rejected
  // rather than thrown. Same shape as TeamMemberRepo.archive.
  const data = await repo.updateWorkingHours(id, workingHoursPerDay);
  if (!data) {
    return { ok: false, error: "Team member not found" };
  }

  return { ok: true, data };
}

export type ArchiveTeamMemberResult =
  | { ok: true; data: TeamMember }
  | { ok: false; error: string };

export async function archiveTeamMember(
  repo: TeamMemberRepo,
  id: string,
): Promise<ArchiveTeamMemberResult> {
  // repo.archive does the "is this id currently active" check and the write
  // as one atomic DB operation -- null means unknown id or already archived,
  // both rejected the same way rather than silently re-archiving. A separate
  // list()-then-archive would leave a race window between two concurrent
  // requests for the same id.
  const data = await repo.archive(id);
  if (!data) {
    return { ok: false, error: "Team member not found or already removed" };
  }

  return { ok: true, data };
}

export type AllocationCategory = {
  id: string;
  name: string;
  isDev: boolean;
};

export type AllocationCategoryRepo = {
  create(data: { name: string }): Promise<AllocationCategory>;
  list(): Promise<AllocationCategory[]>;
  rename(id: string, name: string): Promise<AllocationCategory | null>;
  remove(id: string): Promise<AllocationCategory | null>;
  setDev(id: string): Promise<AllocationCategory | null>;
  unsetDev(id: string): Promise<AllocationCategory | null>;
};

export type AddAllocationCategoryInput = {
  name: string;
};

export type AddAllocationCategoryResult =
  | { ok: true; data: AllocationCategory }
  | { ok: false; error: string };

function validateAllocationCategoryName(name: string | undefined): string | { ok: false; error: string } {
  const trimmed = name?.trim();
  if (!trimmed) {
    return { ok: false, error: "Name is required" };
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `Name must be ${MAX_NAME_LENGTH} characters or fewer` };
  }
  return trimmed;
}

export async function addAllocationCategory(
  repo: AllocationCategoryRepo,
  input: AddAllocationCategoryInput,
): Promise<AddAllocationCategoryResult> {
  const name = validateAllocationCategoryName(input.name);
  if (typeof name !== "string") {
    return name;
  }

  const data = await repo.create({ name });

  return { ok: true, data };
}

export type RenameAllocationCategoryResult =
  | { ok: true; data: AllocationCategory }
  | { ok: false; error: string };

export async function renameAllocationCategory(
  repo: AllocationCategoryRepo,
  id: string,
  name: string,
): Promise<RenameAllocationCategoryResult> {
  const validName = validateAllocationCategoryName(name);
  if (typeof validName !== "string") {
    return validName;
  }

  // repo.rename does the "does this id exist" check and the write as one
  // atomic DB operation -- null means unknown id, rejected rather than
  // thrown. Same shape as TeamMemberRepo.archive.
  const data = await repo.rename(id, validName);
  if (!data) {
    return { ok: false, error: "Category not found" };
  }

  return { ok: true, data };
}

export type SetDevAllocationCategoryResult =
  | { ok: true; data: AllocationCategory }
  | { ok: false; error: string };

export async function setDevAllocationCategory(
  repo: Pick<AllocationCategoryRepo, "setDev">,
  id: string,
): Promise<SetDevAllocationCategoryResult> {
  if (!id?.trim()) {
    return { ok: false, error: "Category id is required" };
  }

  // repo.setDev unsets any previously-Dev category and sets this one in the
  // same transaction -- "does this id exist" and the write are one atomic
  // DB operation, same shape as rename/remove's null-means-not-found pattern.
  const data = await repo.setDev(id);
  if (!data) {
    return { ok: false, error: "Category not found" };
  }

  return { ok: true, data };
}

export type UnsetDevAllocationCategoryResult =
  | { ok: true; data: AllocationCategory }
  | { ok: false; error: string };

export async function unsetDevAllocationCategory(
  repo: Pick<AllocationCategoryRepo, "unsetDev">,
  id: string,
): Promise<UnsetDevAllocationCategoryResult> {
  if (!id?.trim()) {
    return { ok: false, error: "Category id is required" };
  }

  const data = await repo.unsetDev(id);
  if (!data) {
    return { ok: false, error: "Category not found" };
  }

  return { ok: true, data };
}

export type RemoveAllocationCategoryResult =
  | { ok: true; data: AllocationCategory }
  | { ok: false; error: string };

export async function removeAllocationCategory(
  repo: AllocationCategoryRepo,
  allocationRepo: Pick<TeamMemberAllocationRepo, "isCategoryInUse">,
  id: string,
): Promise<RemoveAllocationCategoryResult> {
  if (await allocationRepo.isCategoryInUse(id)) {
    return {
      ok: false,
      error: "Category is in use by a team member's allocation and can't be removed",
    };
  }

  const data = await repo.remove(id);
  if (!data) {
    return { ok: false, error: "Category not found" };
  }

  return { ok: true, data };
}

export type TeamMemberAllocation = {
  id: string;
  teamMemberId: string;
  categoryId: string;
  percent: number;
};

export type TeamMemberAllocationRepo = {
  listForTeamMember(teamMemberId: string): Promise<TeamMemberAllocation[]>;
  replaceForTeamMember(
    teamMemberId: string,
    allocations: { categoryId: string; percent: number }[],
  ): Promise<TeamMemberAllocation[]>;
  isCategoryInUse(categoryId: string): Promise<boolean>;
};

export type SetTeamMemberAllocationsResult =
  | { ok: true; data: TeamMemberAllocation[] }
  | { ok: false; error: string };

export async function setTeamMemberAllocations(
  repo: TeamMemberAllocationRepo,
  teamMemberId: string,
  allocations: { categoryId: string; percent: number }[],
): Promise<SetTeamMemberAllocationsResult> {
  if (!teamMemberId?.trim()) {
    return { ok: false, error: "Team member id is required" };
  }

  const seenCategoryIds = new Set<string>();
  for (const allocation of allocations) {
    if (!Number.isInteger(allocation.percent) || allocation.percent < 0 || allocation.percent > 100) {
      return { ok: false, error: "Percent must be a whole number between 0 and 100" };
    }
    if (seenCategoryIds.has(allocation.categoryId)) {
      return { ok: false, error: "Each category may only appear once" };
    }
    seenCategoryIds.add(allocation.categoryId);
  }

  // A missing row means 0% -- no point persisting a meaningless zero row.
  const nonZero = allocations.filter((allocation) => allocation.percent > 0);

  const data = await repo.replaceForTeamMember(teamMemberId, nonZero);

  return { ok: true, data };
}
