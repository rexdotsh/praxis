const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const RE_YOUTUBE =
  /(?:v=|\/|v\/|embed\/|watch\?.*v=|youtu\.be\/|\/v\/|e\/|watch\?.*vi?=|\/embed\/|\/v\/|vi?\/|watch\?.*vi?=|youtu\.be\/|\/vi?\/|\/e\/)([a-zA-Z0-9_-]{11})/i;

const RE_XML_TRANSCRIPT =
  /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;

export type TranscriptItem = {
  text: string;
  startMs: number;
  durationMs: number;
  lang?: string;
};

function getVideoId(input: string): string {
  if (input.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
  const matchId = input.match(RE_YOUTUBE);
  if (matchId?.[1]) return matchId[1];
  throw new Error('Invalid YouTube video ID or URL');
}

export async function fetchTranscript(
  videoIdOrUrl: string,
  opts?: { lang?: string; userAgent?: string; disableHttps?: boolean },
): Promise<TranscriptItem[]> {
  const videoId = getVideoId(videoIdOrUrl);
  const lang = opts?.lang;
  const userAgent = opts?.userAgent ?? DEFAULT_USER_AGENT;
  const protocol = opts?.disableHttps ? 'http' : 'https';

  const watchUrl = `${protocol}://www.youtube.com/watch?v=${videoId}`;
  const watchRes = await fetch(watchUrl, {
    headers: {
      'User-Agent': userAgent,
      ...(lang ? { 'Accept-Language': lang } : {}),
    },
  });
  if (!watchRes.ok) throw new Error('Video unavailable');

  const watchHtml = await watchRes.text();
  const keyMatch =
    watchHtml.match(/"INNERTUBE_API_KEY":"([^"]+)"/) ||
    watchHtml.match(/INNERTUBE_API_KEY\\":\\"([^\\"]+)\\"/);
  if (!keyMatch) throw new Error('Transcript not available');
  const apiKey = keyMatch[1];

  const playerUrl = `https://www.youtube.com/youtubei/v1/player?key=${apiKey}`;
  const playerBody = {
    context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38' } },
    videoId,
  };
  const playerRes = await fetch(playerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': userAgent,
    },
    body: JSON.stringify(playerBody),
  });
  if (!playerRes.ok) throw new Error('Transcript not available');

  const playerJson = (await playerRes.json()) as any;
  const tracklist =
    playerJson?.captions?.playerCaptionsTracklistRenderer ||
    playerJson?.playerCaptionsTracklistRenderer;
  const tracks = tracklist?.captionTracks as
    | Array<{ baseUrl?: string; url?: string; languageCode?: string }>
    | undefined;
  if (!tracks || tracks.length === 0) throw new Error('Transcript disabled');

  const selected = lang
    ? tracks.find((t) => t.languageCode === lang) || tracks[0]
    : tracks[0];
  let transcriptUrl = selected.baseUrl ?? selected.url;
  if (!transcriptUrl) throw new Error('Transcript not available');
  transcriptUrl = transcriptUrl.replace(/&fmt=[^&]+$/, '');
  if (opts?.disableHttps)
    transcriptUrl = transcriptUrl.replace(/^https:\/\//, 'http://');

  const transcriptRes = await fetch(transcriptUrl, {
    headers: {
      'User-Agent': userAgent,
      ...(lang ? { 'Accept-Language': lang } : {}),
    },
  });
  if (!transcriptRes.ok) throw new Error('Transcript not available');

  const xml = await transcriptRes.text();
  const matches = Array.from(
    xml.matchAll(RE_XML_TRANSCRIPT),
  ) as RegExpMatchArray[];
  const resolvedLang: string | undefined = lang ?? selected.languageCode;
  const items: TranscriptItem[] = matches.map((m) => ({
    text: m[3] ?? '',
    durationMs: Math.round(Number.parseFloat(m[2] ?? '0') * 1000),
    startMs: Math.round(Number.parseFloat(m[1] ?? '0') * 1000),
    ...(resolvedLang ? { lang: resolvedLang } : {}),
  }));
  if (items.length === 0) throw new Error('Transcript not available');
  return items;
}
