/*
  Warnings:

  - You are about to drop the `MessageLog` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "MessageLog" DROP CONSTRAINT "MessageLog_carId_fkey";

-- DropForeignKey
ALTER TABLE "MessageLog" DROP CONSTRAINT "MessageLog_customerId_fkey";

-- DropForeignKey
ALTER TABLE "MessageLog" DROP CONSTRAINT "MessageLog_tenantId_fkey";

-- DropTable
DROP TABLE "MessageLog";

-- DropEnum
DROP TYPE "MessageType";
