-- Adds Recipe.referenceUrl, which was introduced in the schema (feat: add
-- reference URL field to recipes) but never had a migration generated.
-- IF NOT EXISTS guards against environments where the column was previously
-- created via `prisma db push`.
ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "referenceUrl" TEXT;
