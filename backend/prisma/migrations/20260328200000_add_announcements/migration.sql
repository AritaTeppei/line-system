-- CreateTable
CREATE TABLE "Announcement" (
    "id"        SERIAL NOT NULL,
    "title"     TEXT NOT NULL,
    "body"      TEXT NOT NULL,
    "publishAt" TIMESTAMP(3) NOT NULL,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Announcement_publishAt_isActive_idx" ON "Announcement"("publishAt", "isActive");
