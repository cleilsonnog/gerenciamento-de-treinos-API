import { NotFoundError } from "../erros/index.js";
import { prisma } from "../lib/db.js";

interface InputDto {
  userId: string;
  workoutPlanId: string;
  workoutDayId: string;
  exerciseId: string;
  weightInKg: number | null;
}

interface OutputDto {
  id: string;
  name: string;
  weightInKg: number | null;
}

export class UpdateExerciseWeight {
  async execute(dto: InputDto): Promise<OutputDto> {
    const workoutPlan = await prisma.workoutPlan.findFirst({
      where: {
        id: dto.workoutPlanId,
        userId: dto.userId,
      },
    });

    if (!workoutPlan) {
      throw new NotFoundError("Workout plan not found");
    }

    const exercise = await prisma.workoutExercise.findFirst({
      where: {
        id: dto.exerciseId,
        workoutDayId: dto.workoutDayId,
        workoutDay: {
          workoutPlanId: dto.workoutPlanId,
        },
      },
    });

    if (!exercise) {
      throw new NotFoundError("Exercise not found");
    }

    const updated = await prisma.workoutExercise.update({
      where: { id: dto.exerciseId },
      data: { weightInKg: dto.weightInKg },
    });

    return {
      id: updated.id,
      name: updated.name,
      weightInKg: updated.weightInKg,
    };
  }
}
