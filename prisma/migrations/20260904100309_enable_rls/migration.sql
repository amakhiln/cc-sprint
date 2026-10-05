-- Supabase's PostgREST API exposes every table in the `public` schema via
-- the project's anon/service keys regardless of whether the app uses
-- supabase-js. This app only talks to Postgres through Prisma's DATABASE_URL
-- (table owner), which RLS never restricts, so enabling it with no policies
-- closes the PostgREST exposure without touching app behavior.
ALTER TABLE "TeamMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AllocationCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Sprint" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Leave" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Holiday" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "YouTrackConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "YouTrackMcpConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShareToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeamMemberAllocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BacklogIssue" ENABLE ROW LEVEL SECURITY;
