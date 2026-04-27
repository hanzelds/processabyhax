-- AlterTable con default para filas existentes
ALTER TABLE "tasks" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
