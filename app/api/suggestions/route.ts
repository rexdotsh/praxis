import { generateObject } from 'ai';
import { z } from 'zod';
import { openrouter } from '@/lib/ai';

export async function POST(req: Request) {
  const {
    title,
    description,
    transcriptSample,
  }: { title: string; description?: string; transcriptSample?: string } =
    await req.json();

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

  const { object } = await generateObject({
    model: openrouter.chat('openai/gpt-5-chat'),
    system,
    prompt,
    temperature: 0.4,
    schema,
  });

  return Response.json(object);
}
