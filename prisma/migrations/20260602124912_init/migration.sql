-- CreateTable
CREATE TABLE "apps" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "uid" TEXT,
    "sessionId" TEXT,
    "props" JSONB,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientTs" TIMESTAMP(3),

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "uid" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pings" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "apps_slug_key" ON "apps"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "apps_apiKey_key" ON "apps"("apiKey");

-- CreateIndex
CREATE INDEX "events_appId_name_ts_idx" ON "events"("appId", "name", "ts");

-- CreateIndex
CREATE INDEX "events_appId_uid_idx" ON "events"("appId", "uid");

-- CreateIndex
CREATE INDEX "events_appId_ts_idx" ON "events"("appId", "ts");

-- CreateIndex
CREATE INDEX "sessions_appId_startedAt_idx" ON "sessions"("appId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_appId_sessionId_key" ON "sessions"("appId", "sessionId");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_appId_fkey" FOREIGN KEY ("appId") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_appId_fkey" FOREIGN KEY ("appId") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
