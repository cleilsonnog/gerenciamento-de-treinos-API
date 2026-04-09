import { NotFoundError } from "../erros/index.js";
import type { Plan, SubscriptionStatus } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

interface InputDto {
  userId: string;
}

interface OutputDto {
  id: string;
  name: string;
  email: string;
  image: string | null;
  plan: Plan;
  subscriptionStatus: SubscriptionStatus | null;
  stripeCustomerId: string | null;
  role: string;
  banned: boolean;
  banReason: string | null;
  banExpires: string | null;
  createdAt: string;
  weightInGrams: number | null;
  heightInCentimeters: number | null;
  age: number | null;
  bodyFatPercentage: number | null;
  workoutPlansCount: number;
  sessionsCount: number;
}

export class GetAdminUserDetail {
  async execute(dto: InputDto): Promise<OutputDto> {
    const user = await prisma.user.findUnique({
      where: { id: dto.userId },
      include: {
        _count: {
          select: {
            workoutPlans: true,
            sessions: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError("Usuário não encontrado");
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus,
      stripeCustomerId: user.stripeCustomerId,
      role: user.role,
      banned: user.banned,
      banReason: user.banReason,
      banExpires: user.banExpires?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      weightInGrams: user.weightInGrams,
      heightInCentimeters: user.heightInCentimeters,
      age: user.age,
      bodyFatPercentage: user.bodyFatPercentage,
      workoutPlansCount: user._count.workoutPlans,
      sessionsCount: user._count.sessions,
    };
  }
}
