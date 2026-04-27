-- CreateEnum
CREATE TYPE "ActivityEventType" AS ENUM ('task_created', 'task_status_changed', 'task_assigned', 'project_created', 'project_status_changed', 'client_created', 'client_status_changed');

-- CreateEnum
CREATE TYPE "ActivityEntityType" AS ENUM ('task', 'project', 'client');

-- CreateTable
CREATE TABLE "activity_log" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "eventType" "ActivityEventType" NOT NULL,
    "entityType" "ActivityEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_log_createdAt_idx" ON "activity_log"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "activity_log_actorId_createdAt_idx" ON "activity_log"("actorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "activity_log_entityType_entityId_idx" ON "activity_log"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
