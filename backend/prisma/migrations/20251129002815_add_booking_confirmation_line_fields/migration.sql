-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "confirmationLineMessage" TEXT,
ADD COLUMN     "confirmationLineSentAt" TIMESTAMP(3);
