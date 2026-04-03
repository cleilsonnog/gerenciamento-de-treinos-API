import { fromNodeHeaders } from "better-auth/node";
import dayjs from "dayjs";
import { FastifyReply, FastifyRequest } from "fastify";

import { Plan } from "../generated/prisma/enums.js";
import { auth } from "./auth.js";
import { prisma } from "./db.js";

const TRIAL_DAYS = 5;

export const requireActivePlan = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });

  if (!session) {
    return reply.status(401).send({
      error: "Unauthorized",
      code: "UNAUTHORIZED",
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true, subscriptionStatus: true, createdAt: true },
  });

  if (!user) {
    return reply.status(401).send({
      error: "Unauthorized",
      code: "UNAUTHORIZED",
    });
  }

  const hasActiveSubscription =
    user.plan !== Plan.FREE && user.subscriptionStatus === "ACTIVE";

  if (hasActiveSubscription) {
    return;
  }

  const trialEndsAt = dayjs(user.createdAt).add(TRIAL_DAYS, "day");
  const isTrialActive = user.plan === Plan.FREE && dayjs().isBefore(trialEndsAt);

  if (isTrialActive) {
    return;
  }

  return reply.status(403).send({
    error: "Seu período de teste expirou. Assine um plano para continuar.",
    code: "SUBSCRIPTION_REQUIRED",
  });
};
