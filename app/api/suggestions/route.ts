import { generateObject } from 'ai';
import { z } from 'zod';
import { openrouter } from '@/lib/ai';
import { fetchMutation, fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { getAuthToken } from '@/app/auth';

export async function POST(req: Request) {
  try {
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
    if (youtubeId) {
      try {
        const cached = await fetchQuery(api.suggestions.getByVideo, {
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
    if (youtubeId && Array.isArray(object.suggestions)) {
      try {
        const token = await getAuthToken();
        if (token) {
          await fetchMutation(
            api.suggestions.upsertForVideo,
            { youtubeId, suggestions: object.suggestions },
            { token },
          );
        }
      } catch {}
    }

    return Response.json(object);
  } catch (e) {
    console.error('[suggestions]', e);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
