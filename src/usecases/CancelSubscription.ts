import { NoActiveSubscriptionError, NotFoundError } from "../erros/index.js";
import { Plan } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";
import { stripe } from "../lib/stripe.js";

interface InputDto {
  userId: string;
}

interface OutputDto {
  message: string;
}

export class CancelSubscription {
  execute = async (dto: InputDto): Promise<OutputDto> => {
    const user = await prisma.user.findUnique({
      where: { id: dto.userId },
      select: { subscriptionId: true, plan: true },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (!user.subscriptionId || user.plan === Plan.FREE) {
      throw new NoActiveSubscriptionError("No active subscription to cancel");
    }

    await stripe.subscriptions.cancel(user.subscriptionId);

    await prisma.user.update({
      where: { id: dto.userId },
      data: {
        plan: Plan.FREE,
        subscriptionStatus: "CANCELED",
        subscriptionId: null,
      },
    });

    return { message: "Subscription canceled successfully" };
  };
}
