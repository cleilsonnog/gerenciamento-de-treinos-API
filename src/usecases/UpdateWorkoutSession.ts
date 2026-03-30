import { NotFoundError } from "../erros/index.js";
import { prisma } from "../lib/db.js";

interface InputDto {
  workoutPlanId: string;
  workoutDayId: string;
  sessionId: string;
  userId: string;
  completedAt: string;
}

interface OutputDto {
  id: string;
  completedAt: string;
  startedAt: string;
}

export class UpdateWorkoutSession {
  async execute(dto: InputDto): Promise<OutputDto> {
    const workoutPlan = await prisma.workoutPlan.findFirst({
      where: {
        id: dto.workoutPlanId,
        userId: dto.userId,
      },
    });

    if (!workoutPlan) {
      throw new NotFoundError("Workout plan not found");
    }

    const workoutDay = await prisma.workoutDay.findFirst({
      where: {
        id: dto.workoutDayId,
        workoutPlanId: dto.workoutPlanId,
      },
    });

    if (!workoutDay) {
      throw new NotFoundError("Workout day not found");
    }

    const existingSession = await prisma.workoutSession.findFirst({
      where: {
        id: dto.sessionId,
        workoutDayId: dto.workoutDayId,
      },
    });

    if (!existingSession) {
      throw new NotFoundError("Workout session not found");
    }

    const session = await prisma.workoutSession.update({
      where: { id: dto.sessionId },
      data: { completedAt: new Date(dto.completedAt) },
    });

    return {
      id: session.id,
      completedAt: session.completedAt!.toISOString(),
      startedAt: session.startedAt.toISOString(),
    };
  }
}
