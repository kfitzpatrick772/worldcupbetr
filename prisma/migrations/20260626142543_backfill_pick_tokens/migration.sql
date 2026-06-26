-- Backfill capability tokens for participants created before the column existed.
-- gen_random_uuid() is built into Postgres 13+ and is unguessable enough for a
-- per-contestant pick link. New participants get a cuid() via the Prisma default.
UPDATE "Participant" SET "pickToken" = gen_random_uuid()::text WHERE "pickToken" IS NULL;
