/*
  Warnings:

  - You are about to drop the column `content` on the `ReminderMessageTemplate` table. All the data in the column will be lost.
  - Added the required column `body` to the `ReminderMessageTemplate` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ReminderTemplateType" AS ENUM ('SHAKEN_2M', 'SHAKEN_1W', 'TENKEN_1M', 'BIRTHDAY_TODAY', 'CUSTOM_DATE');

-- AlterTable
ALTER TABLE "ReminderMessageTemplate" DROP COLUMN "content",
ADD COLUMN     "body" TEXT NOT NULL,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "title" TEXT;
