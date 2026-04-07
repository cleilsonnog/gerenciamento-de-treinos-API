import {
  NotFoundError,
  SessionAlreadyStartedError,
  WorkoutPlanNotActiveError,
} from "../erros/index.js";
import { prisma } from "../lib/db.js";

interface InputDto {
  workoutPlanId: string;
  workoutDayId: string;
  userId: string;
}

interface OutputDto {
  workoutSessionId: string;
}

export class StartWorkoutSession {
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

    if (!workoutPlan.isActive) {
      throw new WorkoutPlanNotActiveError("Workout plan is not active");
    }

    const workoutDay = await prisma.workoutDay.findFirst({
      where: {
        id: dto.workoutDayId,
        workoutPlanId: dto.workoutPlanId,
      },
      include: {
        sessions: true,
        exercises: true,
      },
    });

    if (!workoutDay) {
      throw new NotFoundError("Workout day not found");
    }

    if (workoutDay.sessions.length > 0) {
      throw new SessionAlreadyStartedError(
        "Workout day already has a started session",
      );
    }

    const session = await prisma.workoutSession.create({
      data: {
        workoutDayId: dto.workoutDayId,
        startedAt: new Date(),
        sessionExercises: {
          create: workoutDay.exercises.map((exercise) => ({
            exerciseId: exercise.id,
          })),
        },
      },
    });

    return {
      workoutSessionId: session.id,
    };
  }
}
