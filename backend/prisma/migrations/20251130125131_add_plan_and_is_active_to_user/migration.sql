-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('BASIC', 'STANDARD', 'PRO');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "maxConcurrentSessions" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "plan" "Plan" DEFAULT 'BASIC';
