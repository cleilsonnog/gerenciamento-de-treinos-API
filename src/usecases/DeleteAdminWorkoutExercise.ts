import { NotFoundError } from "../erros/index.js";
import { prisma } from "../lib/db.js";

interface InputDto {
  userId: string;
  exerciseId: string;
}

export class DeleteAdminWorkoutExercise {
  async execute(dto: InputDto): Promise<void> {
    const exercise = await prisma.workoutExercise.findUnique({
      where: { id: dto.exerciseId },
      include: {
        workoutDay: {
          include: {
            workoutPlan: true,
          },
        },
      },
    });

    if (!exercise || exercise.workoutDay.workoutPlan.userId !== dto.userId) {
      throw new NotFoundError("Exercício não encontrado");
    }

    await prisma.workoutExercise.delete({
      where: { id: dto.exerciseId },
    });
  }
}
