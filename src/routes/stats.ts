import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";

import { auth } from "../lib/auth.js";
import {
  ErrorSchema,
  GetStatsQuerySchema,
  GetStatsResponseSchema,
} from "../schemas/index.js";
import { GetStats } from "../usecases/GetStats.js";

export const statsRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/",
    schema: {
      operationId: "getStats",
      tags: ["Stats"],
      summary: "Get workout statistics for a date range",
      querystring: GetStatsQuerySchema,
      response: {
        200: GetStatsResponseSchema,
        401: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const session = await auth.api.getSession({
          headers: fromNodeHeaders(request.headers),
        });
        if (!session) {
          return reply.status(401).send({
            error: "Unauthorized",
            code: "UNAUTHORIZED",
          });
        }
        const getStats = new GetStats();
        const result = await getStats.execute({
          userId: session.user.id,
          from: request.query.from,
          to: request.query.to,
          timezone: request.query.timezone,
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
