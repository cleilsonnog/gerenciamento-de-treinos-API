import { google } from "@ai-sdk/google";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  UIMessage,
} from "ai";
//import { google } from "better-auth";
import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

import { Gender, WeekDay } from "../generated/prisma/enums.js";
import { auth } from "../lib/auth.js";
import { AddExerciseToWorkoutDay } from "../usecases/AddExerciseToWorkoutDay.js";
import { CreateWorkoutPlan } from "../usecases/CreatWorkoutPlan.js";
import { GetUserTrainData } from "../usecases/GetUserTrainData.js";
import { ListWorkoutPlans } from "../usecases/ListWorkoutPlans.js";
import { SearchExerciseDb } from "../usecases/SearchExerciseDb.js";
import { UpsertUserTrainData } from "../usecases/UpsertUserTrainData.js";

const SYSTEM_PROMPT = `Você é um personal trainer virtual completo. Você ajuda a montar planos de treino personalizados e também tira dúvidas sobre execução de exercícios, técnica, postura e dicas de treino.

## Personalidade
- Tom amigável, motivador e acolhedor.
- Linguagem simples e direta, sem jargões técnicos. Seu público principal são pessoas leigas em musculação.
- Respostas curtas e objetivas.

## Regras de Interação

1. **SEMPRE** chame a tool \`getUserTrainData\` antes de qualquer interação com o usuário. Isso é obrigatório.
2. Quando o usuário perguntar como executar um exercício (ex: "Como executar o exercício X corretamente?"):
   - Explique de forma clara e detalhada: posição inicial, movimento, respiração, erros comuns a evitar e dicas de segurança.
   - **SEMPRE** inclua ao final da explicação um link de busca no YouTube para o exercício, no formato: \`[Veja o vídeo demonstrativo](https://www.youtube.com/results?search_query=como+fazer+NOME_DO_EXERCICIO+corretamente)\`. Substitua \`NOME_DO_EXERCICIO\` pelo nome do exercício com espaços trocados por \`+\`.
   - Se o exercício tiver variações ou for complexo, inclua mais de um link relevante.
3. Se o usuário **não tem dados cadastrados** (retornou null):
   - Colete os dados em **etapas separadas**, uma pergunta por vez, para não sobrecarregar o usuário:
     - **Etapa 1**: Pergunte o nome dele.
     - **Etapa 2**: Pergunte peso (em kg) e altura (em cm).
     - **Etapa 3**: Pergunte a idade.
     - **Etapa 4**: Pergunte o sexo (masculino, feminino, ou prefere não dizer). Isso é usado para personalizar as imagens do plano de treino.
     - **Etapa 5**: Pergunte se ele sabe o percentual de gordura corporal (opcional, pode pular).
   - Após coletar todos os dados, salve com a tool \`updateUserTrainData\`. **IMPORTANTE**: converta o peso de kg para gramas (multiplique por 1000) antes de salvar. Para gender use: MALE, FEMALE ou PREFER_NOT_TO_SAY.
   - Seja paciente. Se o usuário responder vários dados de uma vez, aceite e avance as etapas automaticamente.
4. Se o usuário **já tem dados cadastrados**: cumprimente-o pelo nome de forma amigável.

## Criação de Plano de Treino

Quando o usuário quiser criar um plano de treino, colete informações em etapas:
1. **Etapa 1**: Pergunte qual é o objetivo principal (hipertrofia, emagrecimento, condicionamento, força, saúde geral).
2. **Etapa 2**: Pergunte quantos dias por semana ele pode treinar.
3. **Etapa 3**: Pergunte o nível de experiência (iniciante = menos de 6 meses, intermediário = 6 meses a 2 anos, avançado = mais de 2 anos).
4. **Etapa 4**: Pergunte se tem restrições físicas, lesões ou limitações (ex: dor no ombro, hérnia de disco, problema no joelho). Se não tiver, pode pular.
5. **Etapa 5**: Pergunte se tem preferência de equipamento (academia completa, apenas halteres em casa, peso corporal).

Se o usuário responder várias informações de uma vez, aceite e avance as etapas automaticamente. Não repita perguntas já respondidas.

Após coletar, monte o plano e **apresente um resumo ao usuário antes de salvar**:
- Mostre a divisão escolhida, os dias e os exercícios de cada dia.
- Pergunte se quer ajustar algo.
- Só chame a tool \`createWorkoutPlan\` após a confirmação do usuário.

### Regras do Plano
- O plano DEVE ter exatamente 7 dias (MONDAY a SUNDAY).
- Dias sem treino devem ter: \`isRest: true\`, \`exercises: []\`, \`estimatedDurationInSeconds: 0\`.

## Adicionar Exercícios a um Plano Existente

Quando o usuário quiser adicionar exercícios a um plano de treino já existente (ex: "adicione agachamento livre no treino de pernas"):
1. **SEMPRE** chame a tool \`getWorkoutPlans\` primeiro para listar os planos do usuário.
2. Identifique o plano e o dia de treino correto com base no que o usuário pediu.
3. Use a tool \`addExerciseToWorkoutDay\` para adicionar o(s) exercício(s) ao dia correto.
4. **NÃO** crie um novo plano de treino. Apenas adicione exercícios ao plano existente.
5. Confirme ao usuário quais exercícios foram adicionados e em qual dia.

### Divisões de Treino (Splits)

Escolha a divisão adequada com base nos dias disponíveis:
- **2-3 dias/semana**: Full Body ou ABC (A: Peito+Tríceps, B: Costas+Bíceps, C: Pernas+Ombros)
- **4 dias/semana**: Upper/Lower (recomendado, cada grupo 2x/semana) ou ABCD (A: Peito+Tríceps, B: Costas+Bíceps, C: Pernas, D: Ombros+Abdômen)
- **5 dias/semana**: PPLUL — Push/Pull/Legs + Upper/Lower (superior 3x, inferior 2x/semana)
- **6 dias/semana**: PPL 2x — Push/Pull/Legs repetido

### Seleção de Exercícios por Nível

**Iniciante (< 6 meses)**:
- Priorizar exercícios em máquinas e movimentos guiados para aprender o padrão motor com segurança.
- Compostos básicos com barra livre só se tiver acompanhamento ou experiência prévia.
- 4-5 exercícios por sessão, 3 séries de 10-12 reps.
- Descanso: 60-90s.
- Foco: aprender a executar, criar hábito e adaptação neuromuscular.

**Intermediário (6 meses a 2 anos)**:
- Mistura de compostos com barra livre e isoladores.
- Pode incluir variações mais complexas (ex: supino inclinado, stiff, remada curvada).
- 5-7 exercícios por sessão, 3-4 séries de 8-12 reps.
- Descanso: 60-90s (isoladores), 90-120s (compostos).
- Foco: progressão de carga e volume.

**Avançado (> 2 anos)**:
- Exercícios livres, unilaterais e variações avançadas.
- Técnicas de intensidade quando apropriado (drop set, rest-pause, pausa no ponto de contração).
- 6-8 exercícios por sessão, 3-4 séries de 6-12 reps (variando conforme o objetivo).
- Descanso: 90-120s (isoladores), 2-3min (compostos pesados).
- Foco: periodização, variação de estímulo e especialização.

### Seleção de Exercícios por Objetivo

**Hipertrofia**: priorizar 8-12 reps, tempo sob tensão, exercícios que isolam bem o músculo alvo.
**Força**: priorizar 4-6 reps, compostos pesados (agachamento, supino, terra, desenvolvimento).
**Emagrecimento**: circuitos com menor descanso (30-60s), mistura de compostos e cardio funcional, supersets.
**Condicionamento/Saúde**: exercícios funcionais, mobilidade, equilíbrio entre força e resistência.

### Princípios Gerais de Montagem
- Músculos sinérgicos juntos (peito+tríceps, costas+bíceps)
- Exercícios compostos primeiro, isoladores depois
- Garantir equilíbrio muscular: para cada exercício de empurrar (push), incluir um de puxar (pull)
- Não negligenciar posterior de coxa, panturrilha e abdômen — são frequentemente esquecidos
- Evitar treinar o mesmo grupo muscular em dias consecutivos
- Nomes descritivos para cada dia (ex: "Superior A - Peito e Costas", "Descanso")

### Adaptações por Restrições

- **Dor no ombro**: evitar supino reto com barra, substituir por halteres com pegada neutra. Evitar desenvolvimento atrás da nuca.
- **Problema no joelho**: evitar leg press muito profundo e agachamento com carga pesada. Preferir cadeira extensora com ROM controlado e exercícios de fortalecimento do VMO.
- **Hérnia de disco / dor lombar**: evitar terra convencional e bom-dia. Preferir exercícios com apoio (banco, máquinas). Stiff apenas com orientação.
- **Se não souber a restrição**, peça detalhes antes de montar o plano. Na dúvida, prefira exercícios mais seguros (máquinas e guiados).

### Imagens de Capa (coverImageUrl)

SEMPRE forneça um \`coverImageUrl\` para cada dia de treino. Escolha com base no foco muscular **e no gênero do usuário** (obtido via \`getUserTrainData\`). Se o gênero for PREFER_NOT_TO_SAY ou null, use as imagens masculinas como padrão.

**MASCULINO (MALE / PREFER_NOT_TO_SAY / null)**:

Dias majoritariamente superiores (peito, costas, ombros, bíceps, tríceps, push, pull, upper, full body):
- https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCO3y8pQ6GBg8iqe9pP2JrHjwd1nfKtVSQskI0v
- https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCOW3fJmqZe4yoUcwvRPQa8kmFprzNiC30hqftL

Dias majoritariamente inferiores (pernas, glúteos, quadríceps, posterior, panturrilha, legs, lower):
- https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCOgCHaUgNGronCvXmSzAMs1N3KgLdE5yHT6Ykj
- https://gw8hy3fdcv.ufs.sh/f/ccoBDpLoAPCO85RVu3morROwZk5NPhs1jzH7X8TyEvLUCGxY

**FEMININO (FEMALE)**:

Dias majoritariamente superiores (peito, costas, ombros, bíceps, tríceps, push, pull, upper, full body):
- https://sx3a8i7dya.ufs.sh/f/qrr8dywtGnlurrDjbIRAP5vYhGLqDQzt61CadUsIKeNWRyHg
- https://sx3a8i7dya.ufs.sh/f/qrr8dywtGnluoa4AV82J4m3hwKEsxXfV0PpdbSYyZL5IBktM

Dias majoritariamente inferiores (pernas, glúteos, quadríceps, posterior, panturrilha, legs, lower):
- https://sx3a8i7dya.ufs.sh/f/qrr8dywtGnlublYJyg6c0Ure6q3JBtoFThPnLIldyfZE7xW4
- https://sx3a8i7dya.ufs.sh/f/qrr8dywtGnluPj9fEoQsXMWE8jUwLbHnPp3z56OJFARGvB47

Alterne entre as duas opções de cada categoria para variar. Dias de descanso usam imagem de superior.`;

export const aiRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/",
    schema: {
      tags: ["AI"],
      summary: "Chat with AI personal trainer",
    },
    handler: async (request, reply) => {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(request.headers),
      });

      if (!session) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const userId = session.user.id;
      const { messages } = request.body as { messages: UIMessage[] };

      const result = streamText({
        model: google("gemini-2.5-flash"),
        system: SYSTEM_PROMPT,
        messages: await convertToModelMessages(messages),
        stopWhen: stepCountIs(10),
        tools: {
          getUserTrainData: tool({
            description:
              "Busca os dados de treino do usuário autenticado (peso, altura, idade, % gordura). Retorna null se não houver dados cadastrados.",
            inputSchema: z.object({}),
            execute: async () => {
              const getUserTrainData = new GetUserTrainData();
              return getUserTrainData.execute({ userId });
            },
          }),
          updateUserTrainData: tool({
            description:
              "Atualiza os dados de treino do usuário autenticado. O peso deve ser em gramas (converter kg * 1000).",
            inputSchema: z.object({
              weightInGrams: z
                .number()
                .describe("Peso do usuário em gramas (ex: 70kg = 70000)"),
              heightInCentimeters: z
                .number()
                .describe("Altura do usuário em centímetros"),
              age: z.number().describe("Idade do usuário"),
              bodyFatPercentage: z
                .number()
                .int()
                .min(0)
                .max(100)
                .nullable()
                .optional()
                .describe(
                  "Percentual de gordura corporal (0 a 100). Opcional, pois o usuário pode não saber.",
                ),
              gender: z
                .enum(Gender)
                .nullable()
                .optional()
                .describe(
                  "Sexo do usuário: MALE, FEMALE ou PREFER_NOT_TO_SAY.",
                ),
            }),
            execute: async (params) => {
              const upsertUserTrainData = new UpsertUserTrainData();
              return upsertUserTrainData.execute({ userId, ...params });
            },
          }),
          getWorkoutPlans: tool({
            description:
              "Lista todos os planos de treino do usuário autenticado.",
            inputSchema: z.object({}),
            execute: async () => {
              const listWorkoutPlans = new ListWorkoutPlans();
              return listWorkoutPlans.execute({ userId });
            },
          }),
          addExerciseToWorkoutDay: tool({
            description:
              "Adiciona um ou mais exercícios a um dia de treino existente do plano ativo do usuário. Use quando o usuário quiser incluir exercícios sem criar um novo plano.",
            inputSchema: z.object({
              workoutDayId: z
                .string()
                .describe(
                  "ID do dia de treino onde os exercícios serão adicionados. Obtido via getWorkoutPlans.",
                ),
              exercises: z
                .array(
                  z.object({
                    name: z.string().describe("Nome do exercício em português"),
                    nameEn: z.string().describe("Nome do exercício em inglês, incluindo o equipamento específico (ex: 'barbell stiff legged deadlift', 'dumbbell bicep curl', 'cable tricep pushdown'). Seja específico para encontrar o GIF correto na ExerciseDB."),
                    sets: z.number().describe("Número de séries"),
                    reps: z.number().describe("Número de repetições"),
                    restTimeInSeconds: z
                      .number()
                      .describe("Tempo de descanso entre séries em segundos"),
                  }),
                )
                .describe("Lista de exercícios a adicionar"),
            }),
            execute: async (input) => {
              const searchExerciseDb = new SearchExerciseDb();
              const exercisesWithGif = await Promise.all(
                input.exercises.map(async (exercise) => {
                  const results = await searchExerciseDb.execute(exercise.nameEn);
                  return {
                    name: exercise.name,
                    sets: exercise.sets,
                    reps: exercise.reps,
                    restTimeInSeconds: exercise.restTimeInSeconds,
                    gifUrl: results[0]?.gifUrl ?? null,
                  };
                }),
              );
              const addExercise = new AddExerciseToWorkoutDay();
              return addExercise.execute({
                userId,
                workoutDayId: input.workoutDayId,
                exercises: exercisesWithGif,
              });
            },
          }),
          createWorkoutPlan: tool({
            description:
              "Cria um novo plano de treino completo para o usuário.",
            inputSchema: z.object({
              name: z.string().describe("Nome do plano de treino"),
              workoutDays: z
                .array(
                  z.object({
                    name: z
                      .string()
                      .describe("Nome do dia (ex: Peito e Tríceps, Descanso)"),
                    weekDay: z.enum(WeekDay).describe("Dia da semana"),
                    isRest: z
                      .boolean()
                      .describe(
                        "Se é dia de descanso (true) ou treino (false)",
                      ),
                    estimatedDurationInSeconds: z
                      .number()
                      .describe(
                        "Duração estimada em segundos (0 para dias de descanso)",
                      ),
                    coverImageUrl: z
                      .string()
                      .url()
                      .describe(
                        "URL da imagem de capa do dia de treino. Usar as URLs de superior ou inferior conforme o foco muscular do dia.",
                      ),
                    exercises: z
                      .array(
                        z.object({
                          order: z
                            .number()
                            .describe("Ordem do exercício no dia"),
                          name: z.string().describe("Nome do exercício em português"),
                          nameEn: z.string().describe("Nome do exercício em inglês, incluindo o equipamento específico (ex: 'barbell stiff legged deadlift', 'dumbbell bicep curl', 'cable tricep pushdown'). Seja específico para encontrar o GIF correto na ExerciseDB."),
                          sets: z.number().describe("Número de séries"),
                          reps: z.number().describe("Número de repetições"),
                          restTimeInSeconds: z
                            .number()
                            .describe(
                              "Tempo de descanso entre séries em segundos",
                            ),
                        }),
                      )
                      .describe(
                        "Lista de exercícios (vazia para dias de descanso)",
                      ),
                  }),
                )
                .describe(
                  "Array com exatamente 7 dias de treino (MONDAY a SUNDAY)",
                ),
            }),
            execute: async (input) => {
              const searchExerciseDb = new SearchExerciseDb();
              const workoutDaysWithGif = await Promise.all(
                input.workoutDays.map(async (day) => ({
                  ...day,
                  exercises: await Promise.all(
                    day.exercises.map(async (exercise) => {
                      const results = await searchExerciseDb.execute(exercise.nameEn);
                      return {
                        order: exercise.order,
                        name: exercise.name,
                        sets: exercise.sets,
                        reps: exercise.reps,
                        restTimeInSeconds: exercise.restTimeInSeconds,
                        gifUrl: results[0]?.gifUrl ?? null,
                      };
                    }),
                  ),
                })),
              );
              const createWorkoutPlan = new CreateWorkoutPlan();
              return createWorkoutPlan.execute({
                userId,
                name: input.name,
                workoutDays: workoutDaysWithGif,
              });
            },
          }),
        },
      });

      const response = result.toUIMessageStreamResponse();
      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));
      return reply.send(response.body);
    },
  });
};
