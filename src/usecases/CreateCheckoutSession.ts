import { prisma } from "../lib/db.js";
import { env } from "../lib/env.js";
import { stripe } from "../lib/stripe.js";

interface InputDto {
  userId: string;
  userEmail: string;
  plan: "YEARLY" | "LIFETIME";
}

interface OutputDto {
  checkoutUrl: string;
}

const PRICE_IDS: Record<string, string> = {
  YEARLY: env.STRIPE_PRICE_YEARLY_ID,
  LIFETIME: env.STRIPE_PRICE_LIFETIME_ID,
};

export class CreateCheckoutSession {
  execute = async (dto: InputDto): Promise<OutputDto> => {
    const user = await prisma.user.findUnique({
      where: { id: dto.userId },
    });

    let customerId = user?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: dto.userEmail,
        metadata: { userId: dto.userId },
      });
      customerId = customer.id;

      await prisma.user.update({
        where: { id: dto.userId },
        data: { stripeCustomerId: customerId },
      });
    }

    const priceId = PRICE_IDS[dto.plan];
    const isLifetime = dto.plan === "LIFETIME";

    const session = await stripe.checkout.sessions.create({
      mode: isLifetime ? "payment" : "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      ...(!isLifetime && {
        subscription_data: {
          trial_period_days: 14,
        },
      }),
      success_url: `${env.WEB_APP_BASE_URL[0]}/profile`,
      cancel_url: `${env.WEB_APP_BASE_URL[0]}/landing#planos`,
      metadata: { userId: dto.userId, plan: dto.plan },
    });

    if (!session.url) {
      throw new Error("Failed to create checkout session");
    }

    return { checkoutUrl: session.url };
  };
}
