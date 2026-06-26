-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "pickToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Participant_pickToken_key" ON "Participant"("pickToken");
