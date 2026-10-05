-- CreateTable
CREATE TABLE "YouTrackMcpConfig" (
    "id" TEXT NOT NULL,
    "serverUrl" TEXT NOT NULL,
    "authToken" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "YouTrackMcpConfig_pkey" PRIMARY KEY ("id")
);
