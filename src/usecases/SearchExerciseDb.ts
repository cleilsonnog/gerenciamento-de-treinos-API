interface ExerciseDbResult {
  exerciseId: string;
  name: string;
  gifUrl: string;
}

export class SearchExerciseDb {
  async execute(query: string): Promise<ExerciseDbResult[]> {
    const response = await fetch(
      `https://oss.exercisedb.dev/api/v1/exercises/search?search=${encodeURIComponent(query)}`,
    );

    if (!response.ok) return [];

    const data = (await response.json()) as {
      success: boolean;
      data: ExerciseDbResult[];
    };

    return data.data;
  }
}
