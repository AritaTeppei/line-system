-- CreateTable
CREATE TABLE "CustomerRegisterToken" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "lineUid" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerRegisterToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerRegisterToken_token_key" ON "CustomerRegisterToken"("token");

-- AddForeignKey
ALTER TABLE "CustomerRegisterToken" ADD CONSTRAINT "CustomerRegisterToken_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
