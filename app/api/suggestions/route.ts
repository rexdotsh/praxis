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

  const system = `You craft 5 short, clickable learning prompts tailored to one YouTube video.

Quality:
- Distinct, concrete, actionable; active voice; no fluff.

Constraints:
- Under 80 characters.
- No numbering, quotes, emojis, hashtags, or trailing punctuation.
- Do not use the words “video”, “YouTube”, “transcript”, or “prompt”. Do not go out of the context of the video.
- Vary intent (explain, compare, apply, critique, steps, real-world).
- Ground with relevant topic terms; keep factual and concise.

Output:
- Exactly 5 suggestions satisfying all constraints.`;

  const prompt = [
    'Context:',
    `Title: ${title}`,
    description ? `Description: ${description.slice(0, 800)}` : null,
    transcriptSample
      ? `Transcript (truncated):\n${transcriptSample.slice(0, 4000)}`
      : null,
    'Task: Write 5 diverse, concrete prompts that meet the constraints.',
    'Respond with only {"suggestions": string[5]}.',
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
