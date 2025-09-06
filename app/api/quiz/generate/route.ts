import { NextResponse } from 'next/server';
import { fetchMutation } from 'convex/nextjs';
import { z } from 'zod';
import { generateObject } from 'ai';
import { openrouter } from '@/lib/ai';
import { api } from '@/convex/_generated/api';
import { getAuthToken } from '@/app/auth';

const schema = z.object({
  youtubeId: z.string(),
  model: z.string().default('openai/gpt-4.1-mini'),
  transcriptContext: z.string().trim().min(1, 'Transcript excerpt required'),
  contextSpec: z.object({
    type: z.enum(['minutes', 'chapter']),
    value: z.number().int().positive(),
  }),
  numQuestions: z.number().int().min(3).max(10).default(5),
  choicesCount: z.literal(4).default(4),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  meta: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      channel: z.string().optional(),
    })
    .default({}),
});

const QuizGenerationSchema = z.object({
  questions: z
    .array(
      z.object({
        prompt: z.string(),
        options: z.array(z.string()).length(4),
        correctIndex: z.number().int().min(0).max(3),
        explanation: z.string(),
      }),
    )
    .min(3)
    .max(10),
});

export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const {
      youtubeId,
      model,
      transcriptContext,
      contextSpec,
      numQuestions,
      choicesCount,
      difficulty,
      meta,
    } = parsed.data;

    const token = await getAuthToken();
    if (!token)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const system = `Create ${numQuestions} multiple-choice questions (exactly ${choicesCount} options each) based strictly on the provided transcript context. Write the questions, options, and explanations in English only. Avoid hallucinating details not present in the context. Options must be mutually exclusive. Include a brief explanation for the correct answer.`;

    const prompt = JSON.stringify({
      contextSpec,
      transcriptExcerpt: (transcriptContext ?? '').slice(0, 8000),
      difficulty,
      choicesCount,
      numQuestions,
      meta: {
        title: meta.title ?? youtubeId,
        channel: meta.channel ?? 'Unknown',
        description: meta.description ?? '',
      },
    });

    const { object } = await generateObject({
      model: openrouter.chat(model),
      system,
      prompt,
      temperature: 0.3,
      schema: QuizGenerationSchema,
    });

    // Ensure user & video exist
    const userId = await fetchMutation(api.users.upsertCurrent, {}, { token });
    const videoId = await fetchMutation(
      api.users.upsertVideo,
      {
        youtubeId,
        title: meta.title ?? youtubeId,
        url: `https://www.youtube.com/watch?v=${youtubeId}`,
        channel: meta.channel ?? 'Unknown',
        durationMs: undefined,
        views: undefined,
        thumbnailUrl: undefined,
      },
      { token },
    );

    // Create quiz and save questions
    const quizId = await fetchMutation(
      api.quizzes.createQuizWithQuestions,
      {
        videoId,
        createdByUserId: userId,
        spec: {
          type:
            contextSpec.type === 'minutes' ? 'last_minutes' : 'last_chapter',
          value: contextSpec.value,
        },
        meta: {
          title: meta.title ?? '',
          description: meta.description,
          channel: meta.channel,
        },
        numQuestions,
        choicesCount,
        difficulty,
        model,
        questions: object.questions,
      },
      { token },
    );

    const sessionId = await fetchMutation(
      api.quizzes.createSession,
      {
        quizId,
        userId,
      },
      { token },
    );

    return NextResponse.json({
      quizId,
      sessionId,
      total: object.questions.length,
    });
  } catch (e) {
    console.error('[quiz/generate]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
