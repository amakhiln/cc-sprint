---
title: 'Mark an Allocation Category as Dev'
type: 'feature'
created: '2026-08-19'
status: 'done'
route: 'one-shot'
review_loop_iteration: 0
context: []
baseline_commit: 'NO_VCS'
---

# Mark an Allocation Category as Dev

## Intent

**Problem:** Story 2.5's Capacity formula needs "Dev Allocation %," but `AllocationCategory` is entirely free-text (Story 1.4) — nothing identifies which category is "the Dev one." This was originally drafted as part of Story 2.5 itself but carved out (see `deferred-work.md`) once the combined spec exceeded the token target — the Dev-flag mechanism is a separate, independently-shippable category-management feature that Story 2.5 merely reads.

**Approach:** Add an `isDev` boolean to `AllocationCategory`, DB-enforced to at most one true row via a hand-added partial unique index (mirroring `Sprint`'s `Sprint_one_active_idx`). A transactional `setDev`/`unsetDev` pair unsets whichever category previously held it before setting a new one. The Roster category row gets a toggle button (`aria-pressed`) and a "Dev" chip; removing the current Dev category gets an inline confirmation warning since it silently drops Capacity back to its no-Dev-category state.

## Suggested Review Order

**Domain**

- `setDevAllocationCategory` / `unsetDevAllocationCategory` — validate-then-delegate, same shape as `renameAllocationCategory`.
  [`allocation.ts:159`](../../domain/allocation.ts#L159)

**Infrastructure**

- `setDev` / `unsetDev` — the transaction + partial-unique-index reliance (documented inline), and the `P2025` not-found handling shared with `rename`/`remove`.
  [`allocation-category-repository.ts:39`](../../infrastructure/db/allocation-category-repository.ts#L39)

- The schema change and its hand-added partial unique index.
  [`schema.prisma:24`](../../prisma/schema.prisma#L24)

**UI**

- The toggle button (`aria-pressed`, label flips Mark/Unmark) and the remove-confirm guard for the current Dev category.
  [`allocation-category-row.tsx:26`](../../app/(pm)/roster/allocation-category-row.tsx#L26)

**Peripheral**

- The self-check — covers set/unset, unsetting unsets exactly the right row, unknown-id rejection, and removing the current Dev category leaving zero Dev rows.
  [`allocation.selfcheck.ts:1`](../../domain/allocation.selfcheck.ts#L1)
