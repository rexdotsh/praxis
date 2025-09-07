import { NextResponse } from 'next/server';
import { fetchMutation, fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { getAuthToken } from '@/app/auth';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('sessionId');
    if (!sessionId)
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });

    const token = await getAuthToken();
    if (!token)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = await fetchMutation(api.users.upsertCurrent, {}, { token });
    // derive answered count and sanitized questions
    const results = await fetchQuery(
      api.quizzes.getSessionResults,
      {
        sessionId: sessionId as any,
        userId,
      },
      { token },
    );
    const sanitized = results.details.map((d) => ({
      questionId: d.questionId,
      prompt: d.prompt,
      options: d.options,
      selectedIndex: d.selectedIndex,
    }));
    const answered = sanitized.filter((q) => q.selectedIndex >= 0).length;
    return NextResponse.json({
      questions: sanitized,
      answered,
      total: results.total,
    });
  } catch (e) {
    console.error('[quiz/session]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
