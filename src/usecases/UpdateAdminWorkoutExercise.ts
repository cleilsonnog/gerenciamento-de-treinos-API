import { prisma } from "../lib/db.js";
import { NotFoundError } from "../erros/index.js";

interface InputDto {
  userId: string;
  exerciseId: string;
  name?: string;
  sets?: number;
  reps?: number;
  restTimeInSeconds?: number;
  weightInKg?: number | null;
}

interface OutputDto {
  id: string;
  order: number;
  name: string;
  sets: number;
  reps: number;
  restTimeInSeconds: number;
  weightInKg: number | null;
}

export class UpdateAdminWorkoutExercise {
  async execute(dto: InputDto): Promise<OutputDto> {
    const exercise = await prisma.workoutExercise.findUnique({
      where: { id: dto.exerciseId },
      include: {
        workoutDay: {
          include: {
            workoutPlan: true,
          },
        },
      },
    });

    if (!exercise || exercise.workoutDay.workoutPlan.userId !== dto.userId) {
      throw new NotFoundError("Exercício não encontrado");
    }

    const updated = await prisma.workoutExercise.update({
      where: { id: dto.exerciseId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.sets !== undefined && { sets: dto.sets }),
        ...(dto.reps !== undefined && { reps: dto.reps }),
        ...(dto.restTimeInSeconds !== undefined && {
          restTimeInSeconds: dto.restTimeInSeconds,
        }),
        ...(dto.weightInKg !== undefined && { weightInKg: dto.weightInKg }),
      },
    });

    return {
      id: updated.id,
      order: updated.order,
      name: updated.name,
      sets: updated.sets,
      reps: updated.reps,
      restTimeInSeconds: updated.restTimeInSeconds,
      weightInKg: updated.weightInKg,
    };
  }
}
