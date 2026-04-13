import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

import { NotFoundError } from "../erros/index.js";
import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

dayjs.extend(utc);
dayjs.extend(timezone);

interface InputDto {
  workoutPlanId: string;
  workoutDayId: string;
  userId: string;
}

interface OutputDto {
  id: string;
  name: string;
  isRest: boolean;
  coverImageUrl?: string | null;
  estimatedDurationInSeconds: number;
  weekDay: WeekDay;
  exercises: Array<{
    id: string;
    name: string;
    order: number;
    workoutDayId: string;
    sets: number;
    reps: number;
    restTimeInSeconds: number;
    weightInKg: number | null;
    gifUrl: string | null;
  }>;
  sessions: Array<{
    id: string;
    workoutDayId: string;
    startedAt?: string | null;
    completedAt?: string | null;
    sessionExercises: Array<{
      id: string;
      exerciseId: string;
      isCompleted: boolean;
    }>;
  }>;
}

export class GetWorkoutDay {
  async execute(dto: InputDto): Promise<OutputDto> {
    const workoutPlan = await prisma.workoutPlan.findUnique({
      where: { id: dto.workoutPlanId },
    });

    if (!workoutPlan) {
      throw new NotFoundError("Workout plan not found");
    }

    if (workoutPlan.userId !== dto.userId) {
      throw new NotFoundError("Workout plan not found");
    }

    const now = dayjs();
    const weekStart = now.day(0).startOf("day");
    const weekEnd = now.day(6).endOf("day");

    const workoutDay = await prisma.workoutDay.findUnique({
      where: { id: dto.workoutDayId, workoutPlanId: dto.workoutPlanId },
      include: {
        exercises: true,
        sessions: {
          where: {
            startedAt: {
              gte: weekStart.toDate(),
              lte: weekEnd.toDate(),
            },
          },
          include: {
            sessionExercises: true,
          },
        },
      },
    });

    if (!workoutDay) {
      throw new NotFoundError("Workout day not found");
    }

    return {
      id: workoutDay.id,
      name: workoutDay.name,
      isRest: workoutDay.isRest,
      coverImageUrl: workoutDay.coverImageUrl,
      estimatedDurationInSeconds: workoutDay.estimatedDurationInSeconds,
      weekDay: workoutDay.weekDay,
      exercises: workoutDay.exercises.map((exercise) => ({
        id: exercise.id,
        name: exercise.name,
        order: exercise.order,
        workoutDayId: exercise.workoutDayId,
        sets: exercise.sets,
        reps: exercise.reps,
        restTimeInSeconds: exercise.restTimeInSeconds,
        weightInKg: exercise.weightInKg,
        gifUrl: exercise.gifUrl,
      })),
      sessions: workoutDay.sessions.map((session) => ({
        id: session.id,
        workoutDayId: session.workoutDayId,
        startedAt: session.startedAt?.toISOString() ?? null,
        completedAt: session.completedAt?.toISOString() ?? null,
        sessionExercises: session.sessionExercises.map((se) => ({
          id: se.id,
          exerciseId: se.exerciseId,
          isCompleted: se.isCompleted,
        })),
      })),
    };
  }
}
