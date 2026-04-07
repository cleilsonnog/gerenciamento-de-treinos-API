import { NoActiveSubscriptionError, NotFoundError } from "../erros/index.js";
import { Plan } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";
import { env } from "../lib/env.js";
import { stripe } from "../lib/stripe.js";

interface InputDto {
  userId: string;
  newPlan: "MONTHLY" | "YEARLY";
}

interface OutputDto {
  message: string;
  plan: Plan;
}

const PRICE_IDS: Record<string, string> = {
  MONTHLY: env.STRIPE_PRICE_MONTHLY_ID,
  YEARLY: env.STRIPE_PRICE_YEARLY_ID,
};

const PLAN_MAP: Record<string, Plan> = {
  MONTHLY: Plan.MONTHLY,
  YEARLY: Plan.YEARLY,
};

export class ChangePlan {
  execute = async (dto: InputDto): Promise<OutputDto> => {
    const user = await prisma.user.findUnique({
      where: { id: dto.userId },
      select: { subscriptionId: true, plan: true },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (!user.subscriptionId || user.plan === Plan.FREE) {
      throw new NoActiveSubscriptionError(
        "No active subscription to change",
      );
    }

    const currentPlanKey = user.plan === Plan.MONTHLY ? "MONTHLY" : "YEARLY";
    if (currentPlanKey === dto.newPlan) {
      return { message: "Already on this plan", plan: user.plan };
    }

    const subscription = await stripe.subscriptions.retrieve(
      user.subscriptionId,
    );

    await stripe.subscriptions.update(user.subscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: PRICE_IDS[dto.newPlan],
        },
      ],
      proration_behavior: "create_prorations",
    });

    const newPlan = PLAN_MAP[dto.newPlan];

    await prisma.user.update({
      where: { id: dto.userId },
      data: { plan: newPlan },
    });

    return {
      message: "Plan changed successfully",
      plan: newPlan,
    };
  };
}
