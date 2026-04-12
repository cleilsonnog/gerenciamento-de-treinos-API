import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";

import { NotFoundError } from "../erros/index.js";
import { auth } from "../lib/auth.js";
import { prisma } from "../lib/db.js";
import { requireAdmin } from "../lib/require-admin.js";
import {
  AddAdminExerciseBodySchema,
  AddAdminExerciseParamsSchema,
  AddAdminExerciseResponseSchema,
  AdminUserDetailParamsSchema,
  AdminUserDetailResponseSchema,
  AdminUserWorkoutPlansParamsSchema,
  BanUserBodySchema,
  BanUserResponseSchema,
  DeleteAdminExerciseParamsSchema,
  DeleteAdminExerciseResponseSchema,
  ErrorSchema,
  GetAdminStatsResponseSchema,
  GetAdminStripeLogsQuerySchema,
  GetAdminStripeLogsResponseSchema,
  GetAdminUserWorkoutPlansResponseSchema,
  ListAdminUsersQuerySchema,
  ListAdminUsersResponseSchema,
  UnbanUserResponseSchema,
  UpdateAdminWorkoutExerciseBodySchema,
  UpdateAdminWorkoutExerciseParamsSchema,
  UpdateAdminWorkoutExerciseResponseSchema,
} from "../schemas/index.js";
import { AddAdminExerciseToWorkoutDay } from "../usecases/AddAdminExerciseToWorkoutDay.js";
import { DeleteAdminWorkoutExercise } from "../usecases/DeleteAdminWorkoutExercise.js";
import { GetAdminStats } from "../usecases/GetAdminStats.js";
import { GetAdminStripeLogs } from "../usecases/GetAdminStripeLogs.js";
import { GetAdminUserDetail } from "../usecases/GetAdminUserDetail.js";
import { GetAdminUserWorkoutPlans } from "../usecases/GetAdminUserWorkoutPlans.js";
import { ListAdminUsers } from "../usecases/ListAdminUsers.js";
import { UpdateAdminWorkoutExercise } from "../usecases/UpdateAdminWorkoutExercise.js";

export const adminRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/stats",
    schema: {
      operationId: "getAdminStats",
      tags: ["Admin"],
      summary: "Get admin dashboard statistics",
      response: {
        200: GetAdminStatsResponseSchema,
        401: ErrorSchema,
        403: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const admin = await requireAdmin(request, reply);
        if (!admin) return;

        const getAdminStats = new GetAdminStats();
        const result = await getAdminStats.execute();
        return reply.status(200).send(result);
      } catch (error) {
        app.log.error(error);
        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/users",
    schema: {
      operationId: "listAdminUsers",
      tags: ["Admin"],
      summary: "List users with pagination and filters",
      querystring: ListAdminUsersQuerySchema,
      response: {
        200: ListAdminUsersResponseSchema,
        401: ErrorSchema,
        403: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const admin = await requireAdmin(request, reply);
        if (!admin) return;

        const listAdminUsers = new ListAdminUsers();
        const result = await listAdminUsers.execute({
          search: request.query.search,
          plan: request.query.plan,
          status: request.query.status,
          page: request.query.page,
          limit: request.query.limit,
        });
        return reply.status(200).send(result);
      } catch (error) {
        app.log.error(error);
        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/users/:userId",
    schema: {
      operationId: "getAdminUserDetail",
      tags: ["Admin"],
      summary: "Get detailed user information",
      params: AdminUserDetailParamsSchema,
      response: {
        200: AdminUserDetailResponseSchema,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const admin = await requireAdmin(request, reply);
        if (!admin) return;

        const getAdminUserDetail = new GetAdminUserDetail();
        const result = await getAdminUserDetail.execute({
          userId: request.params.userId,
        });
        return reply.status(200).send(result);
      } catch (error) {
        if (error instanceof NotFoundError) {
          return reply.status(404).send({
            error: error.message,
            code: "NOT_FOUND",
          });
        }
        app.log.error(error);
        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/users/:userId/ban",
    schema: {
      operationId: "banAdminUser",
      tags: ["Admin"],
      summary: "Ban a user",
      params: AdminUserDetailParamsSchema,
      body: BanUserBodySchema,
      response: {
        200: BanUserResponseSchema,
        401: ErrorSchema,
        403: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const adminResult = await requireAdmin(request, reply);
        if (!adminResult) return;

        await auth.api.banUser({
          headers: fromNodeHeaders(request.headers),
          body: {
            userId: request.params.userId,
            banReason: request.body.banReason,
            banExpiresIn: request.body.banExpiresIn,
          },
        });

        await prisma.adminLog.create({
          data: {
            adminId: adminResult.userId,
            action: "BAN_USER",
            targetUserId: request.params.userId,
            metadata: {
              banReason: request.body.banReason ?? null,
              banExpiresIn: request.body.banExpiresIn ?? null,
            },
          },
        });

        return reply.status(200).send({
          message: "Usuário banido com sucesso",
        });
      } catch (error) {
        app.log.error(error);
        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/users/:userId/unban",
    schema: {
      operationId: "unbanAdminUser",
      tags: ["Admin"],
      summary: "Unban a user",
      params: AdminUserDetailParamsSchema,
      response: {
        200: UnbanUserResponseSchema,
        401: ErrorSchema,
        403: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const adminResult = await requireAdmin(request, reply);
        if (!adminResult) return;

        await auth.api.unbanUser({
          headers: fromNodeHeaders(request.headers),
          body: {
            userId: request.params.userId,
          },
        });

        await prisma.adminLog.create({
          data: {
            adminId: adminResult.userId,
            action: "UNBAN_USER",
            targetUserId: request.params.userId,
          },
        });

        return reply.status(200).send({
          message: "Usuário desbanido com sucesso",
        });
      } catch (error) {
        app.log.error(error);
        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/users/:userId/workout-plans",
    schema: {
      operationId: "getAdminUserWorkoutPlans",
      tags: ["Admin"],
      summary: "List workout plans for a specific user",
      params: AdminUserWorkoutPlansParamsSchema,
      response: {
        200: GetAdminUserWorkoutPlansResponseSchema,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const admin = await requireAdmin(request, reply);
        if (!admin) return;

        const usecase = new GetAdminUserWorkoutPlans();
        const result = await usecase.execute({
          userId: request.params.userId,
        });
        return reply.status(200).send(result);
      } catch (error) {
        if (error instanceof NotFoundError) {
          return reply.status(404).send({
            error: error.message,
            code: "NOT_FOUND",
          });
        }
        app.log.error(error);
        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "PATCH",
    url: "/users/:userId/exercises/:exerciseId",
    schema: {
      operationId: "updateAdminWorkoutExercise",
      tags: ["Admin"],
      summary: "Update a workout exercise for a specific user",
      params: UpdateAdminWorkoutExerciseParamsSchema,
      body: UpdateAdminWorkoutExerciseBodySchema,
      response: {
        200: UpdateAdminWorkoutExerciseResponseSchema,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const admin = await requireAdmin(request, reply);
        if (!admin) return;

        const usecase = new UpdateAdminWorkoutExercise();
        const result = await usecase.execute({
          userId: request.params.userId,
          exerciseId: request.params.exerciseId,
          ...request.body,
        });

        await prisma.adminLog.create({
          data: {
            adminId: admin.userId,
            action: "UPDATE_WORKOUT_EXERCISE",
            targetUserId: request.params.userId,
            metadata: {
              exerciseId: request.params.exerciseId,
              changes: request.body,
            },
          },
        });

        return reply.status(200).send(result);
      } catch (error) {
        if (error instanceof NotFoundError) {
          return reply.status(404).send({
            error: error.message,
            code: "NOT_FOUND",
          });
        }
        app.log.error(error);
        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/users/:userId/days/:workoutDayId/exercises",
    schema: {
      operationId: "addAdminExercise",
      tags: ["Admin"],
      summary: "Add an exercise to a workout day for a specific user",
      params: AddAdminExerciseParamsSchema,
      body: AddAdminExerciseBodySchema,
      response: {
        201: AddAdminExerciseResponseSchema,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const admin = await requireAdmin(request, reply);
        if (!admin) return;

        const usecase = new AddAdminExerciseToWorkoutDay();
        const result = await usecase.execute({
          userId: request.params.userId,
          workoutDayId: request.params.workoutDayId,
          exercise: request.body,
        });

        await prisma.adminLog.create({
          data: {
            adminId: admin.userId,
            action: "ADD_EXERCISE",
            targetUserId: request.params.userId,
            metadata: {
              workoutDayId: request.params.workoutDayId,
              exercise: request.body,
            },
          },
        });

        return reply.status(201).send(result);
      } catch (error) {
        if (error instanceof NotFoundError) {
          return reply.status(404).send({
            error: error.message,
            code: "NOT_FOUND",
          });
        }
        app.log.error(error);
        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "DELETE",
    url: "/users/:userId/exercises/:exerciseId",
    schema: {
      operationId: "deleteAdminExercise",
      tags: ["Admin"],
      summary: "Delete a workout exercise for a specific user",
      params: DeleteAdminExerciseParamsSchema,
      response: {
        200: DeleteAdminExerciseResponseSchema,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const admin = await requireAdmin(request, reply);
        if (!admin) return;

        const usecase = new DeleteAdminWorkoutExercise();
        await usecase.execute({
          userId: request.params.userId,
          exerciseId: request.params.exerciseId,
        });

        await prisma.adminLog.create({
          data: {
            adminId: admin.userId,
            action: "DELETE_EXERCISE",
            targetUserId: request.params.userId,
            metadata: {
              exerciseId: request.params.exerciseId,
            },
          },
        });

        return reply.status(200).send({
          message: "Exercício excluído com sucesso",
        });
      } catch (error) {
        if (error instanceof NotFoundError) {
          return reply.status(404).send({
            error: error.message,
            code: "NOT_FOUND",
          });
        }
        app.log.error(error);
        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/stripe-logs",
    schema: {
      operationId: "getAdminStripeLogs",
      tags: ["Admin"],
      summary: "Get Stripe event logs",
      querystring: GetAdminStripeLogsQuerySchema,
      response: {
        200: GetAdminStripeLogsResponseSchema,
        401: ErrorSchema,
        403: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const admin = await requireAdmin(request, reply);
        if (!admin) return;

        const getAdminStripeLogs = new GetAdminStripeLogs();
        const result = await getAdminStripeLogs.execute({
          type: request.query.type,
          startDate: request.query.startDate,
          endDate: request.query.endDate,
          limit: request.query.limit,
          startingAfter: request.query.startingAfter,
        });
        return reply.status(200).send(result);
      } catch (error) {
        app.log.error(error);
        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });
};
