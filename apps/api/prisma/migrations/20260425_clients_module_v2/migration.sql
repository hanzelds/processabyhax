-- CreateEnum
CREATE TYPE "ClientTier" AS ENUM ('STRATEGIC', 'REGULAR', 'PUNCTUAL', 'POTENTIAL');

-- CreateEnum
CREATE TYPE "ClientHistoryEventType" AS ENUM ('client_created', 'status_changed', 'tier_changed', 'contact_added', 'contact_removed', 'contact_set_primary', 'tag_added', 'tag_removed', 'project_created', 'project_completed');

-- AlterEnum
ALTER TYPE "ClientStatus" ADD VALUE 'POTENTIAL';

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "description" TEXT,
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "relationStart" TIMESTAMP(3),
ADD COLUMN     "tier" "ClientTier" NOT NULL DEFAULT 'REGULAR',
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "client_contacts" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_tags" (
    "clientId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "client_tags_pkey" PRIMARY KEY ("clientId","tagId")
);

-- CreateTable
CREATE TABLE "client_notes" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_history" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "eventType" "ClientHistoryEventType" NOT NULL,
    "description" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_contacts_clientId_isPrimary_idx" ON "client_contacts"("clientId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE INDEX "client_tags_clientId_idx" ON "client_tags"("clientId");

-- CreateIndex
CREATE INDEX "client_notes_clientId_isPinned_createdAt_idx" ON "client_notes"("clientId", "isPinned", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "client_history_clientId_createdAt_idx" ON "client_history"("clientId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_tags" ADD CONSTRAINT "client_tags_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_tags" ADD CONSTRAINT "client_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_history" ADD CONSTRAINT "client_history_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_history" ADD CONSTRAINT "client_history_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

