import { generateObject } from 'ai';
import { z } from 'zod';
import { openrouter } from '@/lib/ai';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';

export async function POST(req: Request) {
  const {
    youtubeId,
    title,
    description,
    transcriptSample,
  }: {
    youtubeId?: string;
    title: string;
    description?: string;
    transcriptSample?: string;
  } = await req.json();

  const schema = z.object({ suggestions: z.array(z.string()).length(5) });

  const system =
    'You generate 5 short, clickable suggestions for a learning chat about a YouTube video.';
  const prompt = [
    `Title: ${title}`,
    description ? `Description: ${description}` : null,
    transcriptSample
      ? `Transcript sample: ${transcriptSample.slice(0, 4000)}`
      : null,
    'Return diverse, brief suggestions (under 80 chars). No numbering, no punctuation at end.',
  ]
    .filter(Boolean)
    .join('\n');

  // Try Convex cache first if youtubeId is provided
  if (youtubeId && process.env.NEXT_PUBLIC_CONVEX_URL) {
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
    try {
      const cached = await convex.query(api.suggestions.getByVideo, {
        youtubeId,
      });
      if (cached?.suggestions?.length) {
        return Response.json({ suggestions: cached.suggestions });
      }
    } catch {}
  }

  const { object } = await generateObject({
    model: openrouter.chat('openai/gpt-4.1-mini'),
    system,
    prompt,
    temperature: 0.4,
    schema,
  });

  // Write-through to Convex cache if available
  if (
    youtubeId &&
    process.env.NEXT_PUBLIC_CONVEX_URL &&
    Array.isArray(object.suggestions)
  ) {
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
    try {
      await convex.mutation(api.suggestions.upsertForVideo, {
        youtubeId,
        suggestions: object.suggestions,
      });
    } catch {}
  }

  return Response.json(object);
}
