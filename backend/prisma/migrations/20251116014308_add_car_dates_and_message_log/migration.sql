/*
  Warnings:

  - Changed the type of `messageType` on the `MessageLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "MessageLog" DROP COLUMN "messageType",
ADD COLUMN     "messageType" TEXT NOT NULL;
