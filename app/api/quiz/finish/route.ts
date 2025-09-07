import { NextResponse } from 'next/server';
import { fetchMutation, fetchQuery } from 'convex/nextjs';
import { z } from 'zod';
import { api } from '@/convex/_generated/api';
import { getAuthToken } from '@/app/auth';

const schema = z.object({ sessionId: z.string() });

export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    const { sessionId } = parsed.data;

    const token = await getAuthToken();
    if (!token)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = await fetchMutation(api.users.upsertCurrent, {}, { token });
    await fetchMutation(
      api.quizzes.finishSession,
      {
        sessionId: sessionId as any,
        userId,
      },
      { token },
    );
    const results = await fetchQuery(
      api.quizzes.getSessionResults,
      {
        sessionId: sessionId as any,
        userId,
      },
      { token },
    );

    return NextResponse.json(results);
  } catch (e) {
    console.error('[quiz/finish]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
