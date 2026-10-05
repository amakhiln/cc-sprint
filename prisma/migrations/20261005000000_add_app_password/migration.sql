-- CreateTable
CREATE TABLE "AppPassword" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,

    CONSTRAINT "AppPassword_pkey" PRIMARY KEY ("id")
);

-- Same PostgREST lockdown as 20260904100309_enable_rls: Prisma connects as
-- table owner (unaffected), anon/service keys see nothing.
ALTER TABLE "AppPassword" ENABLE ROW LEVEL SECURITY;
