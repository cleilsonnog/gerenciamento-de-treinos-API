import { NotFoundError } from "../erros/index.js";
import { prisma } from "../lib/db.js";

interface ExerciseInput {
  name: string;
  sets: number;
  reps: number;
  restTimeInSeconds: number;
  gifUrl?: string | null;
}

interface InputDto {
  userId: string;
  workoutDayId: string;
  exercises: ExerciseInput[];
}

interface OutputDto {
  workoutDayId: string;
  workoutDayName: string;
  addedExercises: Array<{
    id: string;
    name: string;
    order: number;
    sets: number;
    reps: number;
    restTimeInSeconds: number;
  }>;
}

export class AddExerciseToWorkoutDay {
  async execute(dto: InputDto): Promise<OutputDto> {
    const workoutDay = await prisma.workoutDay.findFirst({
      where: {
        id: dto.workoutDayId,
        workoutPlan: {
          userId: dto.userId,
          isActive: true,
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
      throw new NotFoundError("Dia de treino não encontrado ou não pertence ao usuário.");
    }

    const lastOrder = workoutDay.exercises[0]?.order ?? 0;

    const created = await prisma.workoutExercise.createManyAndReturn({
      data: dto.exercises.map((exercise, index) => ({
        name: exercise.name,
        order: lastOrder + index + 1,
        sets: exercise.sets,
        reps: exercise.reps,
        restTimeInSeconds: exercise.restTimeInSeconds,
        gifUrl: exercise.gifUrl ?? null,
        workoutDayId: dto.workoutDayId,
      })),
    });

    return {
      workoutDayId: workoutDay.id,
      workoutDayName: workoutDay.name,
      addedExercises: created.map((e) => ({
        id: e.id,
        name: e.name,
        order: e.order,
        sets: e.sets,
        reps: e.reps,
        restTimeInSeconds: e.restTimeInSeconds,
      })),
    };
  }
}
