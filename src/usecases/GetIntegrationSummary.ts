import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";

import { NotFoundError } from "../erros/index.js";
import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";
import { GetHome } from "./GetHome.js";
import { GetStats } from "./GetStats.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const WEEK_ORDER: WeekDay[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

interface InputDto {
  userEmail: string;
  timezone: string;
}

interface OutputDto {
  date: string;
  workoutPlan: { name: string } | null;
  today: {
    name: string;
    isRest: boolean;
    weekDay: WeekDay;
    estimatedDurationInMinutes: number;
    completed: boolean;
    exercises: Array<{
      name: string;
      sets: number;
      reps: number;
      weightInKg: number | null;
      restTimeInSeconds: number;
    }>;
  } | null;
  weekSchedule: Array<{ weekDay: WeekDay; name: string; isRest: boolean }>;
  workoutStreak: number;
  week: {
    completedWorkouts: number;
    plannedWorkouts: number;
    consistencyByDay: Record<
      string,
      { workoutDayCompleted: boolean; workoutDayStarted: boolean }
    >;
  };
  month: {
    completedWorkoutsCount: number;
    conclusionRate: number;
    totalTimeInMinutes: number;
  };
  lastWorkout: {
    date: string;
    name: string;
    durationInMinutes: number | null;
  } | null;
}

export class GetIntegrationSummary {
  async execute(dto: InputDto): Promise<OutputDto> {
    const tz = dto.timezone;
    const now = dayjs().tz(tz);
    const date = now.format("YYYY-MM-DD");

    const user = await prisma.user.findUnique({
      where: { email: dto.userEmail },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundError("Integration user not found");
    }

    const workoutPlan = await prisma.workoutPlan.findFirst({
      where: { userId: user.id, isActive: true },
      include: { workoutDays: { include: { exercises: true } } },
    });

    const lastSession = await prisma.workoutSession.findFirst({
      where: {
        completedAt: { not: null },
        workoutDay: { workoutPlan: { userId: user.id } },
      },
      orderBy: { startedAt: "desc" },
      include: { workoutDay: { select: { name: true } } },
    });
    const lastWorkout = lastSession
      ? {
          date: dayjs(lastSession.startedAt).tz(tz).format("YYYY-MM-DD"),
          name: lastSession.workoutDay.name,
          durationInMinutes: lastSession.completedAt
            ? Math.round(
                dayjs(lastSession.completedAt).diff(
                  lastSession.startedAt,
                  "minute",
                  true,
                ),
              )
            : null,
        }
      : null;

    if (!workoutPlan) {
      return {
        date,
        workoutPlan: null,
        today: null,
        weekSchedule: [],
        workoutStreak: 0,
        week: { completedWorkouts: 0, plannedWorkouts: 0, consistencyByDay: {} },
        month: { completedWorkoutsCount: 0, conclusionRate: 0, totalTimeInMinutes: 0 },
        lastWorkout,
      };
    }

    const home = await new GetHome().execute({ userId: user.id, date, timezone: tz });
    const stats = await new GetStats().execute({
      userId: user.id,
      from: now.startOf("month").format("YYYY-MM-DD"),
      to: date,
      timezone: tz,
    });

    const todayDay = home.todayWorkoutDay
      ? workoutPlan.workoutDays.find((d) => d.id === home.todayWorkoutDay?.id)
      : undefined;

    const weekSchedule = [...workoutPlan.workoutDays]
      .sort((a, b) => WEEK_ORDER.indexOf(a.weekDay) - WEEK_ORDER.indexOf(b.weekDay))
      .map((d) => ({ weekDay: d.weekDay, name: d.name, isRest: d.isRest }));

    const consistency = Object.values(home.consistencyByDay);

    return {
      date,
      workoutPlan: { name: workoutPlan.name },
      today: todayDay
        ? {
            name: todayDay.name,
            isRest: todayDay.isRest,
            weekDay: todayDay.weekDay,
            estimatedDurationInMinutes: Math.round(
              todayDay.estimatedDurationInSeconds / 60,
            ),
            completed: home.consistencyByDay[date]?.workoutDayCompleted ?? false,
            exercises: [...todayDay.exercises]
              .sort((a, b) => a.order - b.order)
              .map((e) => ({
                name: e.name,
                sets: e.sets,
                reps: e.reps,
                weightInKg: e.weightInKg,
                restTimeInSeconds: e.restTimeInSeconds,
              })),
          }
        : null,
      weekSchedule,
      workoutStreak: home.workoutStreak,
      week: {
        completedWorkouts: consistency.filter((d) => d.workoutDayCompleted).length,
        plannedWorkouts: workoutPlan.workoutDays.filter((d) => !d.isRest).length,
        consistencyByDay: home.consistencyByDay,
      },
      month: {
        completedWorkoutsCount: stats.completedWorkoutsCount,
        conclusionRate: stats.conclusionRate,
        totalTimeInMinutes: Math.round(stats.totalTimeInSeconds / 60),
      },
      lastWorkout,
    };
  }
}
