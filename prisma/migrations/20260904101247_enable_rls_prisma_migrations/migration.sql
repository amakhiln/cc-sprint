-- Prisma's own bookkeeping table lives in `public` too, so it's exposed via
-- PostgREST the same as any app table. Same fix, no policies needed: Prisma
-- connects as table owner, which RLS never restricts.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
