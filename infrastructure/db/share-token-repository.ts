import { randomUUID } from "node:crypto";
import type { ShareTokenRepo } from "@/domain/share-token";
import { prisma } from "@/infrastructure/db/client";

// Singleton via a fixed, hardcoded id -- every read/write targets this one
// row, matching youtrack-config-repository.ts's fixed-PK convention (the
// upsert shape itself differs: youtrack's update always carries real data
// from a save; this one's update is a deliberate no-op, since a token, once
// created, should never change).
const SINGLETON_ID = "singleton";

export const shareTokenRepository: ShareTokenRepo = {
  get() {
    return prisma.shareToken.findUnique({ where: { id: SINGLETON_ID } });
  },
  getOrCreate() {
    // update: {} -- a no-op if the row already exists (confirmed atomic:
    // Prisma compiles this to a single INSERT ... ON CONFLICT DO UPDATE on
    // Postgres, so two concurrent first-ever calls can't produce two
    // different tokens), so an existing token is never regenerated; only
    // the create branch ever calls randomUUID().
    return prisma.shareToken.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, token: randomUUID() },
      update: {},
    });
  },
};
