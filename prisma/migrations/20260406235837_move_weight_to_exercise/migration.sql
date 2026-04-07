/*
  Warnings:

  - You are about to drop the column `weightInKg` on the `SessionExercise` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "SessionExercise" DROP COLUMN "weightInKg";

-- AlterTable
ALTER TABLE "WorkoutExercise" ADD COLUMN     "weightInKg" DOUBLE PRECISION;
