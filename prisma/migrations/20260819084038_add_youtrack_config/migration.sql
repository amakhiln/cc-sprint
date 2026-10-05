-- CreateTable
CREATE TABLE "YouTrackConfig" (
    "id" TEXT NOT NULL,
    "instanceUrl" TEXT NOT NULL,
    "authToken" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "YouTrackConfig_pkey" PRIMARY KEY ("id")
);
