import { NotFoundError } from "../erros/index.js";
import { prisma } from "../lib/db.js";

interface ExerciseInput {
  name: string;
  sets: number;
  reps: number;
  restTimeInSeconds: number;
  weightInKg?: number | null;
}

interface InputDto {
  userId: string;
  workoutDayId: string;
  exercise: ExerciseInput;
}

interface OutputDto {
  id: string;
  name: string;
  order: number;
  sets: number;
  reps: number;
  restTimeInSeconds: number;
  weightInKg: number | null;
}

export class AddAdminExerciseToWorkoutDay {
  async execute(dto: InputDto): Promise<OutputDto> {
    const workoutDay = await prisma.workoutDay.findFirst({
      where: {
        id: dto.workoutDayId,
        workoutPlan: {
          userId: dto.userId,
        },
      },
      include: {
        exercises: {
          orderBy: { order: "desc" },
          take: 1,
        },
      },
    });

    if (!workoutDay) {
      throw new NotFoundError(
        "Dia de treino não encontrado ou não pertence ao usuário."
      );
    }

    const lastOrder = workoutDay.exercises[0]?.order ?? 0;

    const created = await prisma.workoutExercise.create({
      data: {
        name: dto.exercise.name,
        order: lastOrder + 1,
        sets: dto.exercise.sets,
        reps: dto.exercise.reps,
        restTimeInSeconds: dto.exercise.restTimeInSeconds,
        weightInKg: dto.exercise.weightInKg ?? null,
        workoutDayId: dto.workoutDayId,
      },
    });

    return {
      id: created.id,
      name: created.name,
      order: created.order,
      sets: created.sets,
      reps: created.reps,
      restTimeInSeconds: created.restTimeInSeconds,
      weightInKg: created.weightInKg,
    };
  }
}
