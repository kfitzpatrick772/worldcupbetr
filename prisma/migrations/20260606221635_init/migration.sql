-- CreateEnum
CREATE TYPE "Stage" AS ENUM ('GROUP', 'R32', 'R16', 'QF', 'SF', 'THIRD', 'FINAL');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'LIVE', 'FINISHED');

-- CreateEnum
CREATE TYPE "Outcome" AS ENUM ('HOME', 'AWAY', 'DRAW');

-- CreateEnum
CREATE TYPE "AdvanceRound" AS ENUM ('R16', 'QF', 'SF', 'FINAL');

-- CreateEnum
CREATE TYPE "ScoreCategory" AS ENUM ('GROUP_MATCH', 'GROUP_ADVANCE', 'GROUP_WINNER_BONUS', 'GROUP_RUNNERUP_BONUS', 'BEST_THIRD', 'ADVANCE_R16', 'ADVANCE_QF', 'ADVANCE_SF', 'ADVANCE_FINAL', 'CHAMPION', 'RUNNERUP', 'THIRD_PLACE');

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "flag" TEXT NOT NULL,
    "group" TEXT NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "stage" "Stage" NOT NULL,
    "group" TEXT,
    "slotLabel" TEXT,
    "homeTeamId" TEXT,
    "awayTeamId" TEXT,
    "kickoff" TIMESTAMP(3) NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "winnerTeamId" TEXT,
    "externalRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMatchPick" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "predHome" INTEGER NOT NULL,
    "predAway" INTEGER NOT NULL,

    CONSTRAINT "GroupMatchPick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupStandingPick" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "teamId" TEXT NOT NULL,

    CONSTRAINT "GroupStandingPick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BestThirdPick" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,

    CONSTRAINT "BestThirdPick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvancePick" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "round" "AdvanceRound" NOT NULL,
    "teamId" TEXT NOT NULL,

    CONSTRAINT "AdvancePick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalPick" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "championTeamId" TEXT NOT NULL,
    "runnerUpTeamId" TEXT NOT NULL,
    "thirdPlaceTeamId" TEXT NOT NULL,

    CONSTRAINT "FinalPick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupStandingActual" (
    "id" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "teamId" TEXT NOT NULL,

    CONSTRAINT "GroupStandingActual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BestThirdActual" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,

    CONSTRAINT "BestThirdActual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvanceActual" (
    "id" TEXT NOT NULL,
    "round" "AdvanceRound" NOT NULL,
    "teamId" TEXT NOT NULL,

    CONSTRAINT "AdvanceActual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalActual" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "championTeamId" TEXT,
    "runnerUpTeamId" TEXT,
    "thirdPlaceTeamId" TEXT,

    CONSTRAINT "FinalActual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreLine" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "category" "ScoreCategory" NOT NULL,
    "points" INTEGER NOT NULL,
    "matchId" TEXT,
    "teamId" TEXT,
    "group" TEXT,
    "detail" TEXT,

    CONSTRAINT "ScoreLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Standing" (
    "participantId" TEXT NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "prevRank" INTEGER,
    "maxPossible" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Standing_pkey" PRIMARY KEY ("participantId")
);

-- CreateTable
CREATE TABLE "AppState" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "picksLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "lastSettledAt" TIMESTAMP(3),

    CONSTRAINT "AppState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementRun" (
    "id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "summary" JSONB,

    CONSTRAINT "SettlementRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "note" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_code_key" ON "Team"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE INDEX "Team_group_idx" ON "Team"("group");

-- CreateIndex
CREATE UNIQUE INDEX "Match_externalRef_key" ON "Match"("externalRef");

-- CreateIndex
CREATE INDEX "Match_stage_idx" ON "Match"("stage");

-- CreateIndex
CREATE INDEX "Match_group_idx" ON "Match"("group");

-- CreateIndex
CREATE INDEX "Match_kickoff_idx" ON "Match"("kickoff");

-- CreateIndex
CREATE INDEX "Match_status_idx" ON "Match"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Match_stage_group_homeTeamId_awayTeamId_key" ON "Match"("stage", "group", "homeTeamId", "awayTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_name_key" ON "Participant"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_slug_key" ON "Participant"("slug");

-- CreateIndex
CREATE INDEX "GroupMatchPick_matchId_idx" ON "GroupMatchPick"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMatchPick_participantId_matchId_key" ON "GroupMatchPick"("participantId", "matchId");

-- CreateIndex
CREATE INDEX "GroupStandingPick_participantId_idx" ON "GroupStandingPick"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupStandingPick_participantId_group_position_key" ON "GroupStandingPick"("participantId", "group", "position");

-- CreateIndex
CREATE INDEX "BestThirdPick_participantId_idx" ON "BestThirdPick"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "BestThirdPick_participantId_teamId_key" ON "BestThirdPick"("participantId", "teamId");

-- CreateIndex
CREATE INDEX "AdvancePick_participantId_round_idx" ON "AdvancePick"("participantId", "round");

-- CreateIndex
CREATE UNIQUE INDEX "AdvancePick_participantId_round_teamId_key" ON "AdvancePick"("participantId", "round", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "FinalPick_participantId_key" ON "FinalPick"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupStandingActual_group_position_key" ON "GroupStandingActual"("group", "position");

-- CreateIndex
CREATE UNIQUE INDEX "BestThirdActual_teamId_key" ON "BestThirdActual"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "AdvanceActual_round_teamId_key" ON "AdvanceActual"("round", "teamId");

-- CreateIndex
CREATE INDEX "ScoreLine_participantId_idx" ON "ScoreLine"("participantId");

-- CreateIndex
CREATE INDEX "ScoreLine_matchId_idx" ON "ScoreLine"("matchId");

-- CreateIndex
CREATE INDEX "ScoreLine_category_idx" ON "ScoreLine"("category");

-- CreateIndex
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_winnerTeamId_fkey" FOREIGN KEY ("winnerTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMatchPick" ADD CONSTRAINT "GroupMatchPick_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMatchPick" ADD CONSTRAINT "GroupMatchPick_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupStandingPick" ADD CONSTRAINT "GroupStandingPick_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupStandingPick" ADD CONSTRAINT "GroupStandingPick_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BestThirdPick" ADD CONSTRAINT "BestThirdPick_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BestThirdPick" ADD CONSTRAINT "BestThirdPick_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvancePick" ADD CONSTRAINT "AdvancePick_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvancePick" ADD CONSTRAINT "AdvancePick_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalPick" ADD CONSTRAINT "FinalPick_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalPick" ADD CONSTRAINT "FinalPick_championTeamId_fkey" FOREIGN KEY ("championTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalPick" ADD CONSTRAINT "FinalPick_runnerUpTeamId_fkey" FOREIGN KEY ("runnerUpTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalPick" ADD CONSTRAINT "FinalPick_thirdPlaceTeamId_fkey" FOREIGN KEY ("thirdPlaceTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupStandingActual" ADD CONSTRAINT "GroupStandingActual_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BestThirdActual" ADD CONSTRAINT "BestThirdActual_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceActual" ADD CONSTRAINT "AdvanceActual_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreLine" ADD CONSTRAINT "ScoreLine_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Standing" ADD CONSTRAINT "Standing_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
