import { generateObject } from 'ai';
import { z } from 'zod';
import type { TranscriptItem } from '@/lib/youtube/transcript';
import { openrouter } from '@/lib/ai';

export async function POST(req: Request) {
  const {
    transcript,
    preferredCount = 6,
  }: { transcript: TranscriptItem[]; preferredCount?: number } =
    await req.json();

  const schema = z.object({
    chapters: z
      .array(
        z.object({
          title: z.string(),
          startMs: z.number().int().nonnegative(),
        }),
      )
      .min(3)
      .max(20),
  });

  const joined = transcript
    .slice(0, 2000)
    .map((t) => `[${Math.round(t.startMs / 1000)}s] ${t.text}`)
    .join('\n');

  const system =
    'Create concise YouTube chapters from transcript with accurate start times.';
  const prompt = `Preferred chapters: ${preferredCount}. Transcript excerpt (time-tagged):\n${joined}\nReturn JSON.`;

  const { object } = await generateObject({
    model: openrouter.chat('openai/gpt-5-chat'),
    system,
    prompt,
    temperature: 0.3,
    schema,
  });

  return Response.json(object);
}
