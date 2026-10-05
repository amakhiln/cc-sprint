---
title: 'Record Emergency Leave'
type: 'feature'
created: '2026-08-17'
status: 'done'
route: 'one-shot'
---

# Record Emergency Leave

## Intent

**Problem:** The Leave Entry form (built in Story 2.1) could only record Planned Leave — the domain function and Server Action were already generic over `type`, but nothing in the UI ever exposed `"emergency"`.

**Approach:** Add a Planned/Emergency toggle to the existing `LeaveEntryForm`, threading the selected type through to the already-generic `recordLeaveAction` instead of a hardcoded `"planned"` string. Zero domain, infrastructure, or schema changes — this story just turns on a capability the backend already supported. "Capacity recalculates immediately" (the AC's forward reference) is inherently satisfied once Story 2.5 builds Capacity computation, which will read `Leave` rows live; nothing here needs to build recalculation logic.

Blind Hunter review ran against the diff: 2 findings were real and caused by this change (a mismatched ARIA `radiogroup` role on a toggle-button pair, and toggling leave type not clearing a stale error) — both patched. One pre-existing gap (the form's `required` attributes are inert since there's no `<form>`/`onSubmit`, predating this story) was logged to `deferred-work.md` rather than fixed here, since it wasn't caused by this change. The rest (missing tests for a pure UI toggle, no `min`/`max` date linking, generic error-swallowing, no default-to-today for Emergency, etc.) were rejected as either matching established codebase convention, already-adjudicated in a prior review, or out of scope for this small change.

## Suggested Review Order

- The toggle itself — local state, threaded straight into the existing generic `recordLeaveAction` call, no new domain/infra code.
  [`leave-entry-form.tsx:44`](../../app/(pm)/roster/leave-entry-form.tsx#L44)

- The patch-pass fix — clearing a stale error when switching leave type.
  [`leave-entry-form.tsx:51`](../../app/(pm)/roster/leave-entry-form.tsx#L51)

- `handleSave` — unchanged shape from Story 2.1, now passing the selected `type` instead of a hardcoded literal.
  [`leave-entry-form.tsx:21`](../../app/(pm)/roster/leave-entry-form.tsx#L21)
