import dayjs from "dayjs";

import { prisma } from "../lib/db.js";

interface OutputDto {
  totalUsers: number;
  usersByPlan: Record<string, number>;
  activeSubscriptions: number;
  newUsersThisMonth: number;
}

export class GetAdminStats {
  async execute(): Promise<OutputDto> {
    const startOfMonth = dayjs().startOf("month").toDate();

    const [totalUsers, usersByPlan, activeSubscriptions, newUsersThisMonth] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.groupBy({
          by: ["plan"],
          _count: { id: true },
        }),
        prisma.user.count({
          where: { subscriptionStatus: "ACTIVE" },
        }),
        prisma.user.count({
          where: { createdAt: { gte: startOfMonth } },
        }),
      ]);

    const planCounts: Record<string, number> = {};
    for (const group of usersByPlan) {
      planCounts[group.plan] = group._count.id;
    }

    return {
      totalUsers,
      usersByPlan: planCounts,
      activeSubscriptions,
      newUsersThisMonth,
    };
  }
}
