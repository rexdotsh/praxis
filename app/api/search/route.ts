import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import YouTube from 'youtube-sr';
import { generateTextOnce, openrouter } from '@/lib/ai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';

type Candidate = {
  id: string;
  title: string;
  url: string;
  channel: string;
  durationFormatted?: string;
  views?: number;
  thumbnailUrl?: string;
};

const MAX_CANDIDATES = 25;
const FINAL_PICKS = 6;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { query?: string };
    const query = (body.query ?? '').trim();
    if (!query) {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 });
    }

    // TODO: pass in more as we build out onboarding more
    // and also make the prompt way better with a huge focus on this
    const { sessionClaims } = await auth();
    const learnerProfile = sessionClaims?.metadata
      ? {
          grade: (sessionClaims.metadata as any).grade ?? null,
          exams: (sessionClaims.metadata as any).exams ?? null,
          subjects: (sessionClaims.metadata as any).subjects ?? null,
        }
      : null;

    // 1) Refine query
    const refinedQuery = (
      await generateTextOnce({
        model: 'openai/gpt-4.1-mini',
        system:
          'You are an expert learning coach. Rewrite user queries for YouTube search to maximize educational relevance and clarity. If a learner profile is provided (grade, exams, subjects), tailor the query to that context. Keep it concise; no punctuation if unnecessary.',
        prompt: JSON.stringify({ query, learnerProfile }),
        temperature: 0.2,
        maxTokens: 64,
      })
    )
      .trim()
      .replace(/^"|"$/g, '');

    // 2) Search candidates via youtube-sr, filter to last 3 years
    const threeYearsAgo = Date.now() - 1000 * 60 * 60 * 24 * 365 * 3;
    const raw = await YouTube.search(refinedQuery, {
      limit: MAX_CANDIDATES,
      safeSearch: true,
      type: 'video',
    });

    const candidates: Candidate[] = raw
      .filter((v) => {
        if (!v.id) return false;
        if (v.shorts === true) return false;
        const uploadedAtMs = parseUploadedAtToMs(v.uploadedAt);
        return uploadedAtMs ? uploadedAtMs >= threeYearsAgo : true;
      })
      .map((v) => ({
        id: String(v.id),
        title: v.title ?? '',
        url: v.url,
        channel: v.channel?.name ?? '',
        durationFormatted: v.durationFormatted ?? undefined,
        views: v.views ?? undefined,
        thumbnailUrl: v.thumbnail?.url ?? undefined,
      }));

    // 3) Ask AI to pick best 6
    const selectionSystem =
      'You are an educational curator. Given a refined topic, an optional learner profile (grade, exams, subjects), and a list of YouTube candidates with metadata, pick the top 6 videos that best teach the topic for this learner. Optimize for clarity, relevance to the profile, production quality, and prefer newer videos. Diversity is optional (multiple from same channel allowed). Provide very short reasons (<=140 chars). Return strict JSON with an array of {id, reason}.';
    const selectionPrompt = JSON.stringify({
      refinedQuery,
      learnerProfile,
      candidates,
      k: FINAL_PICKS,
    });

    let parsed: { picks: Array<{ id: string; reason: string }> } | null = null;
    try {
      const { object } = await generateObject({
        model: openrouter.chat('openai/gpt-4.1-mini'),
        system: selectionSystem,
        schema: z.object({
          picks: z
            .array(
              z.object({
                id: z.string(),
                reason: z.string().optional().default(''),
              }),
            )
            .min(1)
            .max(FINAL_PICKS),
        }),
        prompt: selectionPrompt,
      });
      parsed = { picks: object.picks.slice(0, FINAL_PICKS) };
    } catch {}

    // 4) If AI fails, fallback to heuristic top 6
    const selected = (parsed?.picks ?? [])
      .map((p) => {
        const match = candidates.find((c) => c.id === p.id);
        return match ? { ...match, reason: p.reason } : null;
      })
      .filter(Boolean) as Array<Candidate & { reason?: string }>;

    const fallback = candidates
      .slice()
      .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
      .slice(0, FINAL_PICKS)
      .map((c) => ({ ...c }));

    const picks = selected.length === FINAL_PICKS ? selected : fallback;

    return NextResponse.json({
      refinedQuery,
      candidatesCount: candidates.length,
      picks,
    });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

function parseUploadedAtToMs(uploadedAt?: string | null): number | null {
  if (!uploadedAt) return null;
  // youtube-sr uses strings like '2 years ago', '3 months ago'
  const m = uploadedAt.match(/(\d+)\s+(year|month|week|day)s?\s+ago/i);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const now = Date.now();
  const msPerUnit: Record<string, number> = {
    year: 365 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
  };
  const ms = n * (msPerUnit[unit] ?? 0);
  return now - ms;
}
