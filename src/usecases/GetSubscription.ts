import dayjs from "dayjs";

import { NotFoundError } from "../erros/index.js";
import { Plan, SubscriptionStatus } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

const TRIAL_DAYS = 5;

interface InputDto {
  userId: string;
}

interface OutputDto {
  plan: Plan;
  subscriptionStatus: SubscriptionStatus | null;
  stripeCustomerId: string | null;
  subscriptionId: string | null;
  trialEndsAt: string;
  isTrialActive: boolean;
  hasAccess: boolean;
}

export class GetSubscription {
  execute = async (dto: InputDto): Promise<OutputDto> => {
    const user = await prisma.user.findUnique({
      where: { id: dto.userId },
      select: {
        plan: true,
        subscriptionStatus: true,
        stripeCustomerId: true,
        subscriptionId: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    const trialEndsAt = dayjs(user.createdAt).add(TRIAL_DAYS, "day");
    const isTrialActive =
      user.plan === Plan.FREE && dayjs().isBefore(trialEndsAt);
    const hasActiveSubscription =
      user.plan !== Plan.FREE && user.subscriptionStatus === "ACTIVE";
    const hasAccess = hasActiveSubscription || isTrialActive;

    return {
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus,
      stripeCustomerId: user.stripeCustomerId,
      subscriptionId: user.subscriptionId,
      trialEndsAt: trialEndsAt.toISOString(),
      isTrialActive,
      hasAccess,
    };
  };
}
