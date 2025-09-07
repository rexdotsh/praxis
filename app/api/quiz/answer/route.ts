import { NextResponse } from 'next/server';
import { fetchMutation } from 'convex/nextjs';
import { z } from 'zod';
import { api } from '@/convex/_generated/api';
import { getAuthToken } from '@/app/auth';

const schema = z.object({
  sessionId: z.string(),
  questionId: z.string(),
  selectedIndex: z.number().int().min(0).max(3),
});

export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    const { sessionId, questionId, selectedIndex } = parsed.data;

    const token = await getAuthToken();
    if (!token)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = await fetchMutation(api.users.upsertCurrent, {}, { token });
    const result = await fetchMutation(
      api.quizzes.submitAnswer,
      {
        sessionId: sessionId as any,
        questionId: questionId as any,
        selectedIndex,
        userId,
      },
      { token },
    );

    return NextResponse.json(result);
  } catch (e) {
    console.error('[quiz/answer]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
