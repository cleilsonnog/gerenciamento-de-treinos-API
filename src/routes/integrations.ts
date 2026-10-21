import { createHash, timingSafeEqual } from "node:crypto";

import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";

import { NotFoundError } from "../erros/index.js";
import { env } from "../lib/env.js";
import {
  ErrorSchema,
  GetIntegrationSummaryQuerySchema,
  GetIntegrationSummaryResponseSchema,
} from "../schemas/index.js";
import { GetIntegrationSummary } from "../usecases/GetIntegrationSummary.js";

// Compares hashes so the check takes the same time for any token length
const isValidToken = (header: string | undefined): boolean => {
  if (!env.INTEGRATION_TOKEN || !header?.startsWith("Bearer ")) {
    return false;
  }
  const sha = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(sha(header.slice(7)), sha(env.INTEGRATION_TOKEN));
};

export const integrationRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/jarvis",
    schema: {
      operationId: "getJarvisIntegrationSummary",
      tags: ["Integrations"],
      summary: "Read-only training summary for the JARVIS assistant (Bearer token)",
      querystring: GetIntegrationSummaryQuerySchema,
      response: {
        200: GetIntegrationSummaryResponseSchema,
        401: ErrorSchema,
        404: ErrorSchema,
        500: ErrorSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        if (!env.INTEGRATION_TOKEN || !env.INTEGRATION_USER_EMAIL) {
          return reply.status(404).send({
            error: "Integration disabled",
            code: "NOT_FOUND_ERROR",
          });
        }
        if (!isValidToken(request.headers.authorization)) {
          return reply.status(401).send({
            error: "Unauthorized",
            code: "UNAUTHORIZED",
          });
        }
        const getIntegrationSummary = new GetIntegrationSummary();
        const result = await getIntegrationSummary.execute({
          userEmail: env.INTEGRATION_USER_EMAIL,
          timezone: request.query.timezone,
        });
        return reply.status(200).send(result);
      } catch (error) {
        app.log.error(error);
        if (error instanceof NotFoundError) {
          return reply.status(404).send({
            error: error.message,
            code: "NOT_FOUND_ERROR",
          });
        }
        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });
};
