import { Prisma } from "../generated/prisma/client.js";
import type { Plan, SubscriptionStatus } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

interface InputDto {
  search?: string;
  plan?: string;
  status?: string;
  page: number;
  limit: number;
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  image: string | null;
  plan: Plan;
  subscriptionStatus: SubscriptionStatus | null;
  role: string;
  banned: boolean;
  createdAt: string;
}

interface OutputDto {
  users: UserItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class ListAdminUsers {
  async execute(dto: InputDto): Promise<OutputDto> {
    const where: Prisma.UserWhereInput = {};

    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search, mode: "insensitive" } },
        { email: { contains: dto.search, mode: "insensitive" } },
      ];
    }

    if (dto.plan) {
      where.plan = dto.plan as Prisma.EnumPlanFilter;
    }

    if (dto.status === "banned") {
      where.banned = true;
    } else if (dto.status === "active") {
      where.banned = false;
      where.subscriptionStatus = "ACTIVE";
    }

    const offset = (dto.page - 1) * dto.limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          plan: true,
          subscriptionStatus: true,
          role: true,
          banned: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: dto.limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users: users.map((user) => ({
        ...user,
        createdAt: user.createdAt.toISOString(),
      })),
      total,
      page: dto.page,
      limit: dto.limit,
      totalPages: Math.ceil(total / dto.limit),
    };
  }
}
