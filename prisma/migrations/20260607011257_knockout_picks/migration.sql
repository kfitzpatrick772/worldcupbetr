-- CreateTable
CREATE TABLE "KnockoutPick" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "slotLabel" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,

    CONSTRAINT "KnockoutPick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnockoutPick_participantId_idx" ON "KnockoutPick"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "KnockoutPick_participantId_slotLabel_key" ON "KnockoutPick"("participantId", "slotLabel");

-- AddForeignKey
ALTER TABLE "KnockoutPick" ADD CONSTRAINT "KnockoutPick_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnockoutPick" ADD CONSTRAINT "KnockoutPick_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

