import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";
import { NotFoundError } from "../erros/index.js";

interface InputDto {
  userId: string;
}

interface OutputDto {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  workoutDays: Array<{
    id: string;
    name: string;
    weekDay: WeekDay;
    isRest: boolean;
    estimatedDurationInSeconds: number;
    exercises: Array<{
      id: string;
      order: number;
      name: string;
      sets: number;
      reps: number;
      restTimeInSeconds: number;
      weightInKg: number | null;
    }>;
  }>;
}

export class GetAdminUserWorkoutPlans {
  async execute(dto: InputDto): Promise<OutputDto[]> {
    const user = await prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundError("Usuário não encontrado");
    }

    const workoutPlans = await prisma.workoutPlan.findMany({
      where: { userId: dto.userId },
      include: {
        workoutDays: {
          include: {
            exercises: { orderBy: { order: "asc" } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return workoutPlans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      isActive: plan.isActive,
      createdAt: plan.createdAt.toISOString(),
      workoutDays: plan.workoutDays.map((day) => ({
        id: day.id,
        name: day.name,
        weekDay: day.weekDay,
        isRest: day.isRest,
        estimatedDurationInSeconds: day.estimatedDurationInSeconds,
        exercises: day.exercises.map((exercise) => ({
          id: exercise.id,
          order: exercise.order,
          name: exercise.name,
          sets: exercise.sets,
          reps: exercise.reps,
          restTimeInSeconds: exercise.restTimeInSeconds,
          weightInKg: exercise.weightInKg,
        })),
      })),
    }));
  }
}
