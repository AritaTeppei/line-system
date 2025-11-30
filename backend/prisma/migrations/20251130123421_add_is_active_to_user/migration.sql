-- CreateEnum
CREATE TYPE "BroadcastTarget" AS ENUM ('CUSTOMER', 'CAR');

-- CreateEnum
CREATE TYPE "ReminderCategory" AS ENUM ('birthday', 'shakenTwoMonths', 'shakenOneWeek', 'inspectionOneMonth', 'custom');

-- AlterTable
ALTER TABLE "BroadcastLog" ADD COLUMN     "target" "BroadcastTarget" NOT NULL DEFAULT 'CUSTOMER';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ReminderSentLog" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" "ReminderCategory" NOT NULL,
    "customerId" INTEGER,
    "carId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderSentLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ReminderSentLog" ADD CONSTRAINT "ReminderSentLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderSentLog" ADD CONSTRAINT "ReminderSentLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderSentLog" ADD CONSTRAINT "ReminderSentLog_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE SET NULL ON UPDATE CASCADE;
