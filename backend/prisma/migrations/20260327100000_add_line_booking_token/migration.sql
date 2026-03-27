CREATE TABLE "LineBookingToken" (
  "id" SERIAL NOT NULL,
  "tenantId" INTEGER NOT NULL,
  "lineUid" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LineBookingToken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LineBookingToken_token_key" UNIQUE ("token"),
  CONSTRAINT "LineBookingToken_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
