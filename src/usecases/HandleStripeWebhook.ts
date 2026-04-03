import Stripe from "stripe";

import { Plan, SubscriptionStatus } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";
import { stripe } from "../lib/stripe.js";

interface InputDto {
  event: Stripe.Event;
}

const STRIPE_STATUS_MAP: Record<string, SubscriptionStatus> = {
  active: SubscriptionStatus.ACTIVE,
  canceled: SubscriptionStatus.CANCELED,
  incomplete: SubscriptionStatus.INCOMPLETE,
  past_due: SubscriptionStatus.PAST_DUE,
};

const mapSubscriptionStatus = (
  status: string,
): SubscriptionStatus | undefined => STRIPE_STATUS_MAP[status];

export class HandleStripeWebhook {
  execute = async (dto: InputDto): Promise<void> => {
    const { event } = dto;

    switch (event.type) {
      case "checkout.session.completed":
        await this.handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      case "invoice.paid":
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case "customer.subscription.updated":
        await this.handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;
    }
  };

  private handleCheckoutCompleted = async (
    session: Stripe.Checkout.Session,
  ): Promise<void> => {
    const userId = session.metadata?.userId;
    const plan = session.metadata?.plan;

    if (!userId || !plan) {
      return;
    }

    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;

    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id;

    const subscription = subscriptionId
      ? await stripe.subscriptions.retrieve(subscriptionId)
      : null;

    await prisma.user.update({
      where: { id: userId },
      data: {
        plan: plan === "MONTHLY" ? Plan.MONTHLY : Plan.QUARTERLY,
        stripeCustomerId: customerId ?? undefined,
        subscriptionId: subscriptionId ?? undefined,
        subscriptionStatus: subscription
          ? (mapSubscriptionStatus(subscription.status) ??
            SubscriptionStatus.ACTIVE)
          : SubscriptionStatus.ACTIVE,
      },
    });
  };

  private handleInvoicePaid = async (
    invoice: Stripe.Invoice,
  ): Promise<void> => {
    const customerId =
      typeof invoice.customer === "string"
        ? invoice.customer
        : invoice.customer?.id;

    if (!customerId) {
      return;
    }

    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!user) {
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: SubscriptionStatus.ACTIVE,
      },
    });
  };

  private handleSubscriptionUpdated = async (
    subscription: Stripe.Subscription,
  ): Promise<void> => {
    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer?.id;

    if (!customerId) {
      return;
    }

    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!user) {
      return;
    }

    const status = mapSubscriptionStatus(subscription.status);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: status ?? user.subscriptionStatus,
        ...(subscription.status === "canceled" && {
          plan: Plan.FREE,
        }),
      },
    });
  };
}
