-- AlterTable: add sessionToken column to UserSession
ALTER TABLE "UserSession" ADD COLUMN "sessionToken" TEXT;

-- CreateIndex: unique index on sessionToken (PostgreSQL allows multiple NULLs)
CREATE UNIQUE INDEX "UserSession_sessionToken_key" ON "UserSession"("sessionToken");
