import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";

import {
  NoActiveSubscriptionError,
  NotFoundError,
} from "../erros/index.js";
import { auth } from "../lib/auth.js";
import { env } from "../lib/env.js";
import { stripe } from "../lib/stripe.js";
import {
  CancelSubscriptionResponseSchema,
  ChangePlanBodySchema,
  ChangePlanResponseSchema,
  CreateCheckoutSessionBodySchema,
  CreateCheckoutSessionResponseSchema,
  ErrorSchema,
  GetSubscriptionResponseSchema,
} from "../schemas/index.js";
import { CancelSubscription } from "../usecases/CancelSubscription.js";
import { ChangePlan } from "../usecases/ChangePlan.js";
import { CreateCheckoutSession } from "../usecases/CreateCheckoutSession.js";
import { GetSubscription } from "../usecases/GetSubscription.js";
import { HandleStripeWebhook } from "../usecases/HandleStripeWebhook.js";

export const stripeRoutes = async (app: FastifyInstance) => {
  // POST /create-checkout-session
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/create-checkout-session",
    schema: {
      tags: ["Stripe"],
      summary: "Create a Stripe checkout session for subscription",
      body: CreateCheckoutSessionBodySchema,
      response: {
        200: CreateCheckoutSessionResponseSchema,
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

        const createCheckoutSession = new CreateCheckoutSession();
        const result = await createCheckoutSession.execute({
          userId: session.user.id,
          userEmail: session.user.email,
          plan: request.body.plan,
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

  // GET /subscription
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/subscription",
    schema: {
      tags: ["Stripe"],
      summary: "Get current user subscription info",
      response: {
        200: GetSubscriptionResponseSchema,
        401: ErrorSchema,
        404: ErrorSchema,
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

        const getSubscription = new GetSubscription();
        const result = await getSubscription.execute({
          userId: session.user.id,
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

  // POST /cancel-subscription
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/cancel-subscription",
    schema: {
      tags: ["Stripe"],
      summary: "Cancel current subscription",
      response: {
        200: CancelSubscriptionResponseSchema,
        400: ErrorSchema,
        401: ErrorSchema,
        404: ErrorSchema,
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

        const cancelSubscription = new CancelSubscription();
        const result = await cancelSubscription.execute({
          userId: session.user.id,
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
        if (error instanceof NoActiveSubscriptionError) {
          return reply.status(400).send({
            error: error.message,
            code: "NO_ACTIVE_SUBSCRIPTION",
          });
        }
        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });

  // POST /change-plan
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/change-plan",
    schema: {
      tags: ["Stripe"],
      summary: "Change subscription plan",
      body: ChangePlanBodySchema,
      response: {
        200: ChangePlanResponseSchema,
        400: ErrorSchema,
        401: ErrorSchema,
        404: ErrorSchema,
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

        const changePlan = new ChangePlan();
        const result = await changePlan.execute({
          userId: session.user.id,
          newPlan: request.body.plan,
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
        if (error instanceof NoActiveSubscriptionError) {
          return reply.status(400).send({
            error: error.message,
            code: "NO_ACTIVE_SUBSCRIPTION",
          });
        }
        return reply.status(500).send({
          error: "Internal server error",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });

  // POST /webhook - Stripe webhook (raw body, no auth)
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/webhook",
    config: {
      rawBody: true,
    },
    schema: {
      tags: ["Stripe"],
      summary: "Handle Stripe webhook events",
      hide: true,
    },
    handler: async (request, reply) => {
      const signature = request.headers["stripe-signature"];

      if (!signature) {
        return reply.status(400).send({
          error: "Missing stripe-signature header",
          code: "MISSING_SIGNATURE",
        });
      }

      try {
        const event = stripe.webhooks.constructEvent(
          request.rawBody as Buffer,
          signature,
          env.STRIPE_WEBHOOK_SECRET,
        );

        const handleStripeWebhook = new HandleStripeWebhook();
        await handleStripeWebhook.execute({ event });

        return reply.status(200).send({ received: true });
      } catch (error) {
        app.log.error(error);
        return reply.status(400).send({
          error: "Webhook signature verification failed",
          code: "WEBHOOK_ERROR",
        });
      }
    },
  });
};
