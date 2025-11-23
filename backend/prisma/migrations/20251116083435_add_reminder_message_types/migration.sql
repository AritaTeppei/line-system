-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MessageType" ADD VALUE 'REMINDER_BIRTHDAY';
ALTER TYPE "MessageType" ADD VALUE 'REMINDER_SHAKEN_2M';
ALTER TYPE "MessageType" ADD VALUE 'REMINDER_SHAKEN_1W';
ALTER TYPE "MessageType" ADD VALUE 'REMINDER_INSPECTION_1M';
ALTER TYPE "MessageType" ADD VALUE 'REMINDER_CUSTOM';
