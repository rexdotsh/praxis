import { streamText, convertToModelMessages } from 'ai';
import type { UIMessage } from 'ai';
import { openrouter } from '@/lib/ai';

export const maxDuration = 30;

export async function POST(req: Request) {
  const {
    messages,
    model,
    webSearch,
    transcriptContext,
    contextSpec,
    chapters,
    meta,
  }: {
    messages: UIMessage[];
    model?: string;
    webSearch?: boolean;
    transcriptContext?: string;
    contextSpec?: { type: 'minutes'; value: number };
    chapters?: Array<{ title: string; startMs: number }>;
    meta?: { title?: string; description?: string; channel?: string };
  } = await req.json();

  const system = [
    'You are an AI learning companion for a YouTube video.',
    'You ALWAYS respond in English, regardless of the user input or transcript language.',
    'Primary context is the provided transcript slice and chapters. Use them to ground your answers.',
    'If the user asks about the video, prioritize answering their question directly, using transcript evidence as support.',
    'If the question is outside the transcript, say so briefly; if web search is enabled you may incorporate sources and cite them.',
    'Be concise, clear, and instructional. Prefer bullet points where appropriate.',
    'Translate any quoted transcript content into English before presenting it.',
  ].join(' ');

  const modelName =
    (webSearch ? 'perplexity/sonar' : model) || 'openai/gpt-4.1-mini';

  const userBoost = transcriptContext
    ? `\n\n[Context Window (${contextSpec?.type ?? 'minutes'}:${contextSpec?.value ?? '?'}):]\n${transcriptContext}`
    : '';

  const chaptersBoost = chapters?.length
    ? `\n\n[Chapters]\n${chapters.map((c) => `- ${c.title} @ ${Math.round(c.startMs / 1000)}s`).join('\n')}`
    : '';

  const metaBoost = meta
    ? `\n\n[Video Meta]\nTitle: ${meta.title ?? ''}\nChannel: ${meta.channel ?? ''}\nDescription: ${(meta.description ?? '').slice(0, 1000)}`
    : '';

  const boosted: UIMessage[] =
    userBoost || chaptersBoost
      ? [
          ...messages,
          {
            role: 'user',
            parts: [
              {
                type: 'text',
                text: `${userBoost}${chaptersBoost}${metaBoost}`,
              },
            ],
          } as any,
        ]
      : messages;

  const result = streamText({
    model: openrouter.chat(modelName),
    messages: convertToModelMessages(boosted as any),
    system,
  });

  return result.toUIMessageStreamResponse({
    sendSources: true,
    sendReasoning: true,
  });
}
