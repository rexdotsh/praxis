import { generateObject } from 'ai';
import { z } from 'zod';
import type { TranscriptItem } from '@/lib/youtube/transcript';
import { openrouter } from '@/lib/ai';

function parseChaptersFromDescription(
  description: string,
): Array<{ title: string; startMs: number }> {
  const chapters: Array<{ title: string; startMs: number }> = [];
  const seen = new Set<number>();
  const lines = description.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    //match HH:MM:SS or MM:SS and allowing optional spaces around ':'
    const match = line.match(
      /\b(?:(\d{1,2})\s*:\s*)?([0-5]?\d)\s*:\s*([0-5]\d)\b/,
    );
    if (!match || match.index == null) continue;

    const hours = match[1] ? Number.parseInt(match[1], 10) : 0;
    const minutes = Number.parseInt(match[2], 10);
    const seconds = Number.parseInt(match[3], 10);
    const startMs = ((hours * 3600 + minutes * 60 + seconds) * 1000) | 0;
    if (seen.has(startMs)) continue;

    const after = line
      .slice(match.index + match[0].length)
      .replace(/^[\s\-–—:|\]\)\.]*/, '')
      .trim();
    const before = line
      .slice(0, match.index)
      .replace(/[\s\-–—:|\[\(]+$/, '')
      .trim();

    let title = after || before || '';

    if (!title) {
      const hh = hours > 0 ? `${String(hours).padStart(1, '0')}:` : '';
      const mm = String(minutes).padStart(2, '0');
      const ss = String(seconds).padStart(2, '0');
      title = `Chapter ${hh}${mm}:${ss}`;
    }

    chapters.push({ title, startMs });
    seen.add(startMs);
  }

  chapters.sort((a, b) => a.startMs - b.startMs);
  return chapters.slice(0, 20);
}

export async function POST(req: Request) {
  const {
    transcript,
    description,
    preferredCount = 6,
    startMs,
    windowMs,
  }: {
    transcript: TranscriptItem[];
    description?: string;
    preferredCount?: number;
    startMs?: number;
    windowMs?: number;
  } = await req.json();

  const schema = z.object({
    chapters: z
      .array(
        z.object({
          title: z.string(),
          startMs: z.number().int().nonnegative(),
        }),
      )
      .min(1)
      .max(20),
  });

  // give priority to timestamps in description parsed via regex first, fallback to transcript based generation if none are found
  if (typeof description === 'string' && description.trim().length > 0) {
    const parsed = parseChaptersFromDescription(description);
    if (parsed.length >= 1) {
      return Response.json({
        chapters: parsed.slice(0, 100),
        source: 'description',
      });
    }
  }

  const safeStartMs = Math.max(0, typeof startMs === 'number' ? startMs : 0);
  const safeWindowMs = Math.max(
    60_000,
    typeof windowMs === 'number' && windowMs > 0 ? windowMs : 15 * 60 * 1000,
  );
  const endMs = safeStartMs + safeWindowMs;

  const windowed = transcript.filter(
    (t) => t.startMs >= safeStartMs && t.startMs < endMs,
  );

  const joined = windowed
    .slice(0, 2000)
    .map((t) => `[${Math.round(t.startMs / 1000)}s] ${t.text}`)
    .join('\n');

  const system =
    'Create concise YouTube chapters from the provided transcript window with accurate absolute start times in milliseconds. Strictly return JSON only.';
  const prompt = `Preferred chapters: ${preferredCount}. Transcript window (time-tagged; absolute seconds):\n${joined}\nReturn JSON.`;

  const { object } = await generateObject({
    model: openrouter.chat('openai/gpt-4.1-mini'),
    system,
    prompt,
    temperature: 0.3,
    schema,
  });

  const out = (object as any)?.chapters ?? [];
  return Response.json({
    chapters: Array.isArray(out) ? out : [],
    source: 'transcript',
    window: { startMs: safeStartMs, windowMs: safeWindowMs },
  });
}
