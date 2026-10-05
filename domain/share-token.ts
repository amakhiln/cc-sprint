// Framework-free business logic. Zero imports from @prisma/client, next, or
// infrastructure/ -- see AD-1 in the Architecture Spine.

// Story 4.4 -- the one standing app-level token gating the read-only Team
// View (AD-4). No wrapping domain function exists here: there's no user
// input to validate -- the token is server-generated and never submitted by
// anyone, so the repo's getOrCreate is called directly by callers.
export type ShareToken = {
  id: string;
  token: string;
};

export type ShareTokenRepo = {
  get(): Promise<ShareToken | null>;
  // Lazily provisions the singleton row on first call; an existing token is
  // never regenerated (AD-4: exactly one standing token, not rotating).
  getOrCreate(): Promise<ShareToken>;
};
