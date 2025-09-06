import type { TranscriptItem } from '@/lib/youtube/transcript';

export function getWindowByMinutes(
  transcript: TranscriptItem[],
  currentTimeMs: number,
  minutes: number,
  maxChars = 24000,
): { text: string; startMs: number; endMs: number } {
  if (!Array.isArray(transcript) || transcript.length === 0) {
    return { text: '', startMs: 0, endMs: 0 };
  }
  // Require a minimum of 5 minutes of playback before enabling context
  const MIN_PAST_MS = 5 * 60 * 1000;
  if (currentTimeMs < MIN_PAST_MS) {
    return { text: '', startMs: 0, endMs: currentTimeMs };
  }
  const windowStart = Math.max(0, currentTimeMs - minutes * 60 * 1000);
  const windowEnd = currentTimeMs;
  const slice = transcript.filter((t) => {
    const tStart = t.startMs;
    const tEnd = t.startMs + t.durationMs;
    return tEnd >= windowStart && tStart <= windowEnd;
  });
  let text = '';
  const first = slice[0];
  const last = slice.length > 0 ? slice[slice.length - 1] : undefined;
  const startMs = first ? first.startMs : windowStart;
  const endMs = last ? last.startMs + last.durationMs : windowEnd;
  for (const t of slice) {
    if (text.length + t.text.length + 1 > maxChars) break;
    text += (text ? ' ' : '') + t.text;
  }
  return { text, startMs, endMs };
}
