/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,mobilePhone]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "customer_tenant_mobile_unique" ON "Customer"("tenantId", "mobilePhone");
