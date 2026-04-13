import z from "zod";

import { Plan, SubscriptionStatus, WeekDay } from "../generated/prisma/enums.js";

const weekDayValues = Object.values(WeekDay) as [WeekDay, ...WeekDay[]];

export const ErrorSchema = z.object({
  error: z.string(),
  code: z.string(),
});

export const StartWorkoutSessionParamsSchema = z.object({
  workoutPlanId: z.string().uuid(),
  workoutDayId: z.string().uuid(),
});

export const StartWorkoutSessionResponseSchema = z.object({
  workoutSessionId: z.uuid(),
});

export const UpdateWorkoutSessionBodySchema = z.object({
  completedAt: z.string(),
});

export const UpdateWorkoutSessionParamsSchema = z.object({
  workoutPlanId: z.string().uuid(),
  workoutDayId: z.string().uuid(),
  sessionId: z.string().uuid(),
});

export const UpdateWorkoutSessionResponseSchema = z.object({
  id: z.uuid(),
  completedAt: z.string(),
  startedAt: z.string(),
});

export const GetHomeParamsSchema = z.object({
  date: z.iso.date(),
});

export const GetHomeQuerySchema = z.object({
  timezone: z.string().default("UTC"),
});

export const GetHomeResponseSchema = z.object({
  activeWorkoutPlanId: z.uuid(),
  todayWorkoutDay: z
    .object({
      workoutPlanId: z.uuid(),
      id: z.uuid(),
      name: z.string(),
      isRest: z.boolean(),
      weekDay: z.enum(WeekDay),
      estimatedDurationInSeconds: z.number(),
      coverImageUrl: z.url().optional(),
      exercisesCount: z.number(),
    })
    .nullable(),
  workoutStreak: z.number(),
  consistencyByDay: z.record(
    z.iso.date(),
    z.object({
      workoutDayCompleted: z.boolean(),
      workoutDayStarted: z.boolean(),
    }),
  ),
});

export const WorkoutPlanSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1),
  coverImageUrl: z.string().url().optional(),
  workoutDays: z.array(
    z.object({
      name: z.string().trim().min(1),
      weekDay: z.enum(weekDayValues),
      isRest: z.boolean().default(false),
      coverImageUrl: z.url().nullish(),
      estimatedDurationInSeconds: z.number().min(1),
      exercises: z.array(
        z.object({
          order: z.number().min(0),
          name: z.string().trim().min(1),
          sets: z.number().min(1),
          reps: z.number().min(1),
          restTimeInSeconds: z.number().min(1),
        }),
      ),
    }),
  ),
});

export const GetWorkoutPlanParamsSchema = z.object({
  id: z.string().uuid(),
});

export const GetWorkoutPlanResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  workoutDays: z.array(
    z.object({
      id: z.uuid(),
      weekDay: z.enum(weekDayValues),
      name: z.string(),
      isRest: z.boolean(),
      coverImageUrl: z.url().nullish(),
      estimatedDurationInSeconds: z.number(),
      exercisesCount: z.number(),
    }),
  ),
});
export const ListWorkoutPlansQuerySchema = z.object({
  active: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

export const ListWorkoutPlansSchema = z.array(
  z.object({
    id: z.uuid(),
    name: z.string(),
    isActive: z.boolean(),
    workoutDays: z.array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        weekDay: z.enum(WeekDay),
        isRest: z.boolean(),
        estimatedDurationInSeconds: z.number(),
        coverImageUrl: z.url().optional(),
        exercises: z.array(
          z.object({
            id: z.uuid(),
            order: z.number(),
            name: z.string(),
            sets: z.number(),
            reps: z.number(),
            restTimeInSeconds: z.number(),
          }),
        ),
      }),
    ),
  }),
);

export const GetWorkoutDayParamsSchema = z.object({
  workoutPlanId: z.string().uuid(),
  workoutDayId: z.string().uuid(),
});

export const SessionExerciseSchema = z.object({
  id: z.uuid(),
  exerciseId: z.uuid(),
  isCompleted: z.boolean(),
});

export const GetWorkoutDayResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  isRest: z.boolean(),
  coverImageUrl: z.url().nullish(),
  estimatedDurationInSeconds: z.number(),
  weekDay: z.enum(weekDayValues),
  exercises: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      order: z.number(),
      workoutDayId: z.uuid(),
      sets: z.number(),
      reps: z.number(),
      restTimeInSeconds: z.number(),
      weightInKg: z.number().nullable(),
      gifUrl: z.string().nullable(),
    }),
  ),
  sessions: z.array(
    z.object({
      id: z.uuid(),
      workoutDayId: z.uuid(),
      startedAt: z.iso.datetime().nullish(),
      completedAt: z.iso.datetime().nullish(),
      sessionExercises: z.array(SessionExerciseSchema),
    }),
  ),
});

export const UpdateSessionExerciseParamsSchema = z.object({
  workoutPlanId: z.string().uuid(),
  sessionId: z.string().uuid(),
  sessionExerciseId: z.string().uuid(),
});

export const UpdateSessionExerciseBodySchema = z.object({
  isCompleted: z.boolean(),
});

export const UpdateSessionExerciseResponseSchema = SessionExerciseSchema;

export const UpdateExerciseWeightParamsSchema = z.object({
  workoutPlanId: z.string().uuid(),
  workoutDayId: z.string().uuid(),
  exerciseId: z.string().uuid(),
});

export const UpdateExerciseWeightBodySchema = z.object({
  weightInKg: z.number().min(0).nullable(),
});

export const UpdateExerciseWeightResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  weightInKg: z.number().nullable(),
});

export const UpsertUserTrainDataBodySchema = z.object({
  weightInGrams: z.number().int().positive(),
  heightInCentimeters: z.number().int().positive(),
  age: z.number().int().positive(),
  bodyFatPercentage: z.number().int().min(0).max(100).nullable().optional(),
});

export const UpsertUserTrainDataResponseSchema = z.object({
  userId: z.string(),
  weightInGrams: z.number(),
  heightInCentimeters: z.number(),
  age: z.number(),
  bodyFatPercentage: z.number().nullable(),
});

export const GetUserTrainDataResponseSchema = z
  .object({
    userId: z.string(),
    userName: z.string(),
    weightInGrams: z.number(),
    heightInCentimeters: z.number(),
    age: z.number(),
    bodyFatPercentage: z.number().nullable(),
  })
  .nullable();

export const GetStatsQuerySchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  timezone: z.string().default("UTC"),
});

export const GetStatsResponseSchema = z.object({
  workoutStreak: z.number(),
  consistencyByDay: z.record(
    z.iso.date(),
    z.object({
      workoutDayCompleted: z.boolean(),
      workoutDayStarted: z.boolean(),
    }),
  ),
  completedWorkoutsCount: z.number(),
  conclusionRate: z.number(),
  totalTimeInSeconds: z.number(),
});

// Stripe schemas

const planValues = Object.values(Plan) as [Plan, ...Plan[]];
const subscriptionStatusValues = Object.values(SubscriptionStatus) as [
  SubscriptionStatus,
  ...SubscriptionStatus[],
];

export const CreateCheckoutSessionBodySchema = z.object({
  plan: z.enum(["MONTHLY", "YEARLY"]),
});

export const CreateCheckoutSessionResponseSchema = z.object({
  checkoutUrl: z.url(),
});

export const GetSubscriptionResponseSchema = z.object({
  plan: z.enum(planValues),
  subscriptionStatus: z.enum(subscriptionStatusValues).nullable(),
  stripeCustomerId: z.string().nullable(),
  subscriptionId: z.string().nullable(),
  currentPeriodEnd: z.iso.datetime().nullable(),
  trialEndsAt: z.iso.datetime(),
  isTrialActive: z.boolean(),
  hasAccess: z.boolean(),
});

export const CancelSubscriptionResponseSchema = z.object({
  message: z.string(),
});

export const ChangePlanBodySchema = z.object({
  plan: z.enum(["MONTHLY", "YEARLY"]),
});

export const ChangePlanResponseSchema = z.object({
  message: z.string(),
  plan: z.enum(planValues),
});

// Admin schemas

export const GetAdminStatsResponseSchema = z.object({
  totalUsers: z.number(),
  usersByPlan: z.record(z.string(), z.number()),
  activeSubscriptions: z.number(),
  newUsersThisMonth: z.number(),
});

export const AdminUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
  plan: z.enum(planValues),
  subscriptionStatus: z.enum(subscriptionStatusValues).nullable(),
  role: z.string(),
  banned: z.boolean(),
  createdAt: z.iso.datetime(),
});

export const ListAdminUsersQuerySchema = z.object({
  search: z.string().optional(),
  plan: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const ListAdminUsersResponseSchema = z.object({
  users: z.array(AdminUserSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

export const AdminUserDetailParamsSchema = z.object({
  userId: z.string(),
});

export const AdminUserDetailResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
  plan: z.enum(planValues),
  subscriptionStatus: z.enum(subscriptionStatusValues).nullable(),
  stripeCustomerId: z.string().nullable(),
  role: z.string(),
  banned: z.boolean(),
  banReason: z.string().nullable(),
  banExpires: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  weightInGrams: z.number().nullable(),
  heightInCentimeters: z.number().nullable(),
  age: z.number().nullable(),
  bodyFatPercentage: z.number().nullable(),
  workoutPlansCount: z.number(),
  sessionsCount: z.number(),
});

export const BanUserBodySchema = z.object({
  banReason: z.string().optional(),
  banExpiresIn: z.number().optional(),
});

export const BanUserResponseSchema = z.object({
  message: z.string(),
});

export const UnbanUserResponseSchema = z.object({
  message: z.string(),
});

export const GetAdminStripeLogsQuerySchema = z.object({
  type: z.string().optional(),
  startDate: z.iso.date().optional(),
  endDate: z.iso.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  startingAfter: z.string().optional(),
});

export const StripeEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  created: z.number(),
  data: z.record(z.string(), z.unknown()),
});

export const GetAdminStripeLogsResponseSchema = z.object({
  events: z.array(StripeEventSchema),
  hasMore: z.boolean(),
});

// Admin Workout Plans schemas

export const AdminUserWorkoutPlansParamsSchema = z.object({
  userId: z.string(),
});

export const AdminWorkoutExerciseSchema = z.object({
  id: z.uuid(),
  order: z.number(),
  name: z.string(),
  sets: z.number(),
  reps: z.number(),
  restTimeInSeconds: z.number(),
  weightInKg: z.number().nullable(),
  gifUrl: z.string().nullable(),
});

export const AdminWorkoutDaySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  weekDay: z.enum(weekDayValues),
  isRest: z.boolean(),
  estimatedDurationInSeconds: z.number(),
  exercises: z.array(AdminWorkoutExerciseSchema),
});

export const AdminWorkoutPlanSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  workoutDays: z.array(AdminWorkoutDaySchema),
});

export const GetAdminUserWorkoutPlansResponseSchema = z.array(
  AdminWorkoutPlanSchema,
);

export const UpdateAdminWorkoutExerciseParamsSchema = z.object({
  userId: z.string(),
  exerciseId: z.string().uuid(),
});

export const UpdateAdminWorkoutExerciseBodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  sets: z.number().int().min(1).optional(),
  reps: z.number().int().min(1).optional(),
  restTimeInSeconds: z.number().int().min(1).optional(),
  weightInKg: z.number().min(0).nullable().optional(),
  gifUrl: z.string().nullable().optional(),
});

export const UpdateAdminWorkoutExerciseResponseSchema =
  AdminWorkoutExerciseSchema;

export const AddAdminExerciseParamsSchema = z.object({
  userId: z.string(),
  workoutDayId: z.string().uuid(),
});

export const AddAdminExerciseBodySchema = z.object({
  name: z.string().trim().min(1),
  sets: z.number().int().min(1),
  reps: z.number().int().min(1),
  restTimeInSeconds: z.number().int().min(1),
  weightInKg: z.number().min(0).nullable().optional(),
  gifUrl: z.string().nullable().optional(),
});

export const AddAdminExerciseResponseSchema = AdminWorkoutExerciseSchema;

export const SearchExerciseDbQuerySchema = z.object({
  q: z.string().min(1),
});

export const SearchExerciseDbResponseSchema = z.array(
  z.object({
    exerciseId: z.string(),
    name: z.string(),
    gifUrl: z.string(),
  }),
);

export const DeleteAdminExerciseParamsSchema = z.object({
  userId: z.string(),
  exerciseId: z.string().uuid(),
});

export const DeleteAdminExerciseResponseSchema = z.object({
  message: z.string(),
});
