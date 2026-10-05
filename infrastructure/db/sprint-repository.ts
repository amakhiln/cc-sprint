import type { SprintRepo } from "@/domain/sprint";
import { prisma } from "@/infrastructure/db/client";

// A sentinel used only to trigger a transaction rollback from inside
// close()'s callback below -- distinguishes "the active-Sprint guard
// failed" (return null) from any genuine unexpected error (rethrow).
class SprintNotActiveError extends Error {}

export const sprintRepository: SprintRepo = {
  findActive() {
    return prisma.sprint.findFirst({ where: { status: "active" } });
  },
  create(data) {
    // Let a unique-constraint violation (the partial index on status =
    // 'active' firing on a race) propagate -- domain/sprint.ts's
    // createSprint catches it and turns it into the same "already active"
    // result as the pre-check.
    return prisma.sprint.create({ data });
  },
  listClosed() {
    // id as a secondary tiebreaker -- startDate has no uniqueness
    // constraint, so two closed Sprints could share one (e.g. unusual/
    // synthetic data); without a tiebreaker Postgres gives no ordering
    // guarantee among tied rows, letting "most recent" flip between page
    // loads (review-patch: Edge Case Hunter found this).
    return prisma.sprint.findMany({ where: { status: "closed" }, orderBy: [{ startDate: "desc" }, { id: "desc" }] });
  },
  async close(id, data) {
    // An interactive transaction (not array-form) -- array-form $transaction
    // commits every statement regardless of another statement's row-match
    // count, so a losing/stale close (the Sprint updateMany matching zero
    // rows) would still silently commit the per-issue loggedHours writes
    // (review-patch: a real bug three review layers independently found).
    // Throwing here aborts and rolls back everything in the transaction,
    // including any per-issue writes -- true all-or-nothing.
    try {
      return await prisma.$transaction(async (tx) => {
        const { count } = await tx.sprint.updateMany({
          where: { id, status: "active" },
          data: {
            status: "closed",
            snapshotCapacityHours: data.snapshotCapacityHours,
            snapshotAllocationBreakdown: data.snapshotAllocationBreakdown,
            snapshotActualVelocityHours: data.snapshotActualVelocityHours,
          },
        });
        if (count === 0) {
          throw new SprintNotActiveError();
        }
        // Scoped to (id, sprintId) -- not just id -- so a stale/forged
        // issueId that doesn't actually belong to this Sprint matches zero
        // rows and is silently skipped, never writes into another Sprint's
        // data (review-patch: the same real bug above).
        await Promise.all(
          data.issueLoggedHours.map(({ issueId, loggedHours }) =>
            tx.backlogIssue.updateMany({
              where: { id: issueId, sprintId: id },
              data: { loggedHours, loggedHoursPulledAt: new Date() },
            }),
          ),
        );
        return tx.sprint.findUniqueOrThrow({ where: { id } });
        // ponytail: one round-trip per issue inside the transaction (~120ms
        // each over the Supabase pooler), so Prisma's 5s default expired at
        // ~40 issues (P2028, reproduced in a pm_test schema). 30s covers ~200
        // issues; past that, batch the per-issue writes into a single UPDATE.
      }, { timeout: 30_000 });
    } catch (error) {
      if (error instanceof SprintNotActiveError) {
        return null;
      }
      throw error;
    }
  },
};
