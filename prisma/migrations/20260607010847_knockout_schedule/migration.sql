-- AlterTable
ALTER TABLE "AppState" ADD COLUMN     "knockoutLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "knockoutLockedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "awaySource" TEXT,
ADD COLUMN     "homeSource" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Match_slotLabel_key" ON "Match"("slotLabel");

