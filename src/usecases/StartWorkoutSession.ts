import dayjs from "dayjs";

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

    const now = dayjs();
    const weekStart = now.day(0).startOf("day");
    const weekEnd = now.day(6).endOf("day");

    const workoutDay = await prisma.workoutDay.findFirst({
      where: {
        id: dto.workoutDayId,
        workoutPlanId: dto.workoutPlanId,
      },
      include: {
        exercises: true,
        sessions: {
          where: {
            startedAt: {
              gte: weekStart.toDate(),
              lte: weekEnd.toDate(),
            },
          },
        },
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
