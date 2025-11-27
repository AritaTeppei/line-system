-- CreateEnum
CREATE TYPE "ReminderMessageType" AS ENUM ('BIRTHDAY', 'SHAKEN_TWO_MONTHS', 'SHAKEN_ONE_WEEK', 'INSPECTION_ONE_MONTH', 'CUSTOM');

-- CreateTable
CREATE TABLE "ReminderMessageTemplate" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "type" "ReminderMessageType" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderMessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReminderMessageTemplate_tenantId_type_key" ON "ReminderMessageTemplate"("tenantId", "type");

-- AddForeignKey
ALTER TABLE "ReminderMessageTemplate" ADD CONSTRAINT "ReminderMessageTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
