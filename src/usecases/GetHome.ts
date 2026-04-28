import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

import { NotFoundError } from "../erros/index.js";
import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const WEEKDAY_MAP: Record<number, string> = {
  0: "SUNDAY",
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: "SATURDAY",
};

interface InputDto {
  userId: string;
  date: string;
  timezone: string;
}

interface OutputDto {
  activeWorkoutPlanId: string;
  todayWorkoutDay: {
    workoutPlanId: string;
    id: string;
    name: string;
    isRest: boolean;
    weekDay: WeekDay;
    estimatedDurationInSeconds: number;
    coverImageUrl?: string;
    exercisesCount: number;
  } | null;
  workoutStreak: number;
  consistencyByDay: Record<
    string,
    {
      workoutDayCompleted: boolean;
      workoutDayStarted: boolean;
    }
  >;
}

export class GetHome {
  async execute(dto: InputDto): Promise<OutputDto> {
    const tz = dto.timezone;
    const currentDate = dayjs.tz(dto.date, tz);

    const workoutPlan = await prisma.workoutPlan.findFirst({
      where: { userId: dto.userId, isActive: true },
      include: {
        workoutDays: {
          include: {
            exercises: true,
            sessions: true,
          },
        },
      },
    });

    if (!workoutPlan) {
      throw new NotFoundError("Active workout plan not found");
    }

    const todayWeekDay = WEEKDAY_MAP[currentDate.day()];
    const todayWorkoutDay = workoutPlan.workoutDays.find(
      (day) => day.weekDay === todayWeekDay,
    );

    const weekStart = currentDate.day(0).startOf("day");
    const weekEnd = currentDate.day(6).endOf("day");

    const weekSessions = await prisma.workoutSession.findMany({
      where: {
        workoutDay: {
          workoutPlanId: workoutPlan.id,
        },
        startedAt: {
          gte: weekStart.toDate(),
          lte: weekEnd.toDate(),
        },
      },
    });

    const consistencyByDay: Record<
      string,
      { workoutDayCompleted: boolean; workoutDayStarted: boolean }
    > = {};

    for (let i = 0; i < 7; i++) {
      const day = weekStart.add(i, "day");
      const dateKey = day.format("YYYY-MM-DD");

      const daySessions = weekSessions.filter(
        (s) => dayjs(s.startedAt).tz(tz).format("YYYY-MM-DD") === dateKey,
      );

      const workoutDayStarted = daySessions.length > 0;
      const workoutDayCompleted = daySessions.some(
        (s) => s.completedAt !== null,
      );

      consistencyByDay[dateKey] = { workoutDayCompleted, workoutDayStarted };
    }

    const workoutStreak = await this.calculateStreak(
      workoutPlan.id,
      workoutPlan.workoutDays,
      currentDate,
      tz,
    );

    return {
      activeWorkoutPlanId: workoutPlan.id,
      todayWorkoutDay: todayWorkoutDay
        ? {
            workoutPlanId: workoutPlan.id,
            id: todayWorkoutDay.id,
            name: todayWorkoutDay.name,
            isRest: todayWorkoutDay.isRest,
            weekDay: todayWorkoutDay.weekDay,
            estimatedDurationInSeconds:
              todayWorkoutDay.estimatedDurationInSeconds,
            coverImageUrl: todayWorkoutDay.coverImageUrl ?? undefined,
            exercisesCount: todayWorkoutDay.exercises.length,
          }
        : null,
      workoutStreak,
      consistencyByDay,
    };
  }

  private async calculateStreak(
    workoutPlanId: string,
    workoutDays: Array<{
      weekDay: string;
      isRest: boolean;
      sessions: Array<{ startedAt: Date; completedAt: Date | null }>;
    }>,
    currentDate: dayjs.Dayjs,
    tz: string,
  ): Promise<number> {
    const planWeekDays = new Set(workoutDays.map((d) => d.weekDay));
    const restWeekDays = new Set(
      workoutDays.filter((d) => d.isRest).map((d) => d.weekDay),
    );

    const allSessions = await prisma.workoutSession.findMany({
      where: {
        workoutDay: { workoutPlanId },
        completedAt: { not: null },
      },
      select: { startedAt: true },
    });

    const completedDates = new Set(
      allSessions.map((s) => dayjs(s.startedAt).tz(tz).format("YYYY-MM-DD")),
    );

    let streak = 0;
    let day = currentDate;
    const todayKey = currentDate.format("YYYY-MM-DD");

    for (let i = 0; i < 365; i++) {
      const weekDay = WEEKDAY_MAP[day.day()];

      if (!planWeekDays.has(weekDay)) {
        day = day.subtract(1, "day");
        continue;
      }

      if (restWeekDays.has(weekDay)) {
        day = day.subtract(1, "day");
        continue;
      }

      const dateKey = day.format("YYYY-MM-DD");

      if (dateKey === todayKey && !completedDates.has(dateKey)) {
        day = day.subtract(1, "day");
        continue;
      }

      if (completedDates.has(dateKey)) {
        streak++;
        day = day.subtract(1, "day");
        continue;
      }

      break;
    }

    return streak;
  }
}
