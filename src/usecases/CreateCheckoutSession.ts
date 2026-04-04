import { prisma } from "../lib/db.js";
import { env } from "../lib/env.js";
import { stripe } from "../lib/stripe.js";

interface InputDto {
  userId: string;
  userEmail: string;
  plan: "MONTHLY" | "QUARTERLY";
}

interface OutputDto {
  checkoutUrl: string;
}

const PRICE_IDS: Record<string, string> = {
  MONTHLY: env.STRIPE_PRICE_MONTHLY_ID,
  QUARTERLY: env.STRIPE_PRICE_QUARTERLY_ID,
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

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
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
