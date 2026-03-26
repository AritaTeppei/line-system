-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "nextPlan" TEXT,
ADD COLUMN     "nextPlanStartAt" TIMESTAMP(3);
