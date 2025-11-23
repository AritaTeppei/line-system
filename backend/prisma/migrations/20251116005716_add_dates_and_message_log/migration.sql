-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('REMINDER_SHAKEN_2M', 'REMINDER_SHAKEN_1W', 'REMINDER_INSPECTION_1M', 'REMINDER_CUSTOM', 'REMINDER_BIRTHDAY', 'MANUAL_CUSTOMER', 'MANUAL_CAR');

-- AlterTable
ALTER TABLE "Car" ADD COLUMN     "customDaysBefore" INTEGER,
ADD COLUMN     "customReminderDate" TIMESTAMP(3),
ADD COLUMN     "inspectionDate" TIMESTAMP(3),
ADD COLUMN     "shakenDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "birthday" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "customerId" INTEGER,
    "carId" INTEGER,
    "lineUid" TEXT,
    "messageType" "MessageType" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE SET NULL ON UPDATE CASCADE;
