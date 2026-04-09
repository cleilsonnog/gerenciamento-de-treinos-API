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

const getSubscriptionPeriodEnd = (
  subscription: Stripe.Subscription,
): Date | undefined => {
  const firstItem = subscription.items.data[0];
  if (!firstItem) return undefined;
  return new Date(firstItem.current_period_end * 1000);
};

const getSubscriptionIdFromInvoice = (
  invoice: Stripe.Invoice,
): string | undefined => {
  const sub = invoice.parent?.subscription_details?.subscription;
  if (!sub) return undefined;
  return typeof sub === "string" ? sub : sub.id;
};

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
      case "invoice.payment_failed":
        await this.handleInvoicePaymentFailed(
          event.data.object as Stripe.Invoice,
        );
        break;
      case "customer.subscription.updated":
        await this.handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;
      case "customer.subscription.deleted":
        await this.handleSubscriptionDeleted(
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
        plan: plan === "MONTHLY" ? Plan.MONTHLY : plan === "YEARLY" ? Plan.YEARLY : Plan.QUARTERLY,
        stripeCustomerId: customerId ?? undefined,
        subscriptionId: subscriptionId ?? undefined,
        subscriptionStatus: subscription
          ? (mapSubscriptionStatus(subscription.status) ??
            SubscriptionStatus.ACTIVE)
          : SubscriptionStatus.ACTIVE,
        currentPeriodEnd: subscription
          ? getSubscriptionPeriodEnd(subscription)
          : undefined,
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

    const subscriptionId = getSubscriptionIdFromInvoice(invoice);

    const subscription = subscriptionId
      ? await stripe.subscriptions.retrieve(subscriptionId)
      : null;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: subscription
          ? getSubscriptionPeriodEnd(subscription)
          : undefined,
      },
    });
  };

  private handleInvoicePaymentFailed = async (
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
        subscriptionStatus: SubscriptionStatus.PAST_DUE,
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
        currentPeriodEnd: getSubscriptionPeriodEnd(subscription),
        ...(subscription.status === "canceled" && {
          plan: Plan.FREE,
        }),
      },
    });
  };

  private handleSubscriptionDeleted = async (
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

    await prisma.user.update({
      where: { id: user.id },
      data: {
        plan: Plan.FREE,
        subscriptionStatus: SubscriptionStatus.CANCELED,
        subscriptionId: null,
        currentPeriodEnd: null,
      },
    });
  };
}
