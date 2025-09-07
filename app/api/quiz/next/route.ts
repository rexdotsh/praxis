import { NextResponse } from 'next/server';
import { fetchMutation, fetchQuery } from 'convex/nextjs';
import { z } from 'zod';
import { api } from '@/convex/_generated/api';
import { getAuthToken } from '@/app/auth';

const schema = z.object({ sessionId: z.string(), quizId: z.string() });

export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    const { sessionId, quizId } = parsed.data;

    const token = await getAuthToken();
    if (!token)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = await fetchMutation(api.users.upsertCurrent, {}, { token });
    const next = await fetchQuery(
      api.quizzes.getNextQuestion,
      {
        quizId: quizId as any,
        sessionId: sessionId as any,
        userId,
      },
      { token },
    );
    return NextResponse.json(next);
  } catch (e) {
    console.error('[quiz/next]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
