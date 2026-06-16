-- Convert existing MONTHLY and QUARTERLY users to FREE before changing enum
UPDATE "user" SET "plan" = 'FREE' WHERE "plan" IN ('MONTHLY', 'QUARTERLY');

-- AlterEnum
CREATE TYPE "Plan_new" AS ENUM ('FREE', 'YEARLY', 'LIFETIME');
ALTER TABLE "user" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "user" ALTER COLUMN "plan" TYPE "Plan_new" USING ("plan"::text::"Plan_new");
ALTER TYPE "Plan" RENAME TO "Plan_old";
ALTER TYPE "Plan_new" RENAME TO "Plan";
DROP TYPE "Plan_old";
ALTER TABLE "user" ALTER COLUMN "plan" SET DEFAULT 'FREE';
