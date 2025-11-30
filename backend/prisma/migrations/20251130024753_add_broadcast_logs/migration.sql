-- CreateTable
CREATE TABLE "BroadcastLog" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "sentCount" INTEGER NOT NULL,
    "targetCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BroadcastLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BroadcastLogCustomer" (
    "id" SERIAL NOT NULL,
    "broadcastLogId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,

    CONSTRAINT "BroadcastLogCustomer_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BroadcastLog" ADD CONSTRAINT "BroadcastLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastLogCustomer" ADD CONSTRAINT "BroadcastLogCustomer_broadcastLogId_fkey" FOREIGN KEY ("broadcastLogId") REFERENCES "BroadcastLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastLogCustomer" ADD CONSTRAINT "BroadcastLogCustomer_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
