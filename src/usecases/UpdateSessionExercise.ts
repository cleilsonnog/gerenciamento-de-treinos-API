import { NotFoundError } from "../erros/index.js";
import { prisma } from "../lib/db.js";

interface InputDto {
  userId: string;
  workoutPlanId: string;
  sessionId: string;
  sessionExerciseId: string;
  isCompleted: boolean;
}

interface OutputDto {
  id: string;
  exerciseId: string;
  isCompleted: boolean;
}

export class UpdateSessionExercise {
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

    const sessionExercise = await prisma.sessionExercise.findFirst({
      where: {
        id: dto.sessionExerciseId,
        sessionId: dto.sessionId,
        session: {
          workoutDay: {
            workoutPlanId: dto.workoutPlanId,
          },
        },
      },
    });

    if (!sessionExercise) {
      throw new NotFoundError("Session exercise not found");
    }

    const updated = await prisma.sessionExercise.update({
      where: { id: dto.sessionExerciseId },
      data: { isCompleted: dto.isCompleted },
    });

    return {
      id: updated.id,
      exerciseId: updated.exerciseId,
      isCompleted: updated.isCompleted,
    };
  }
}
