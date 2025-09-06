import YouTube from 'youtube-sr';
import { fetchTranscript } from '@/lib/youtube/transcript';
import WatchClient from './WatchClient';

type Props = { params: { id: string } };

export default async function WatchPage({ params }: Props) {
  const { id: videoId } = await params;

  // Fetch metadata
  const video = await YouTube.getVideo(
    `https://www.youtube.com/watch?v=${videoId}`,
  ).catch(() => null);

  // Fetch transcript (best-effort)
  const transcript = await fetchTranscript(videoId).catch(() => null);

  const description = video?.description ?? '';
  const title = video?.title ?? 'YouTube Video';
  const channel = video?.channel?.name ?? '';
  const uploadedAt =
    (video as any)?.uploadedAt ?? (video as any)?.uploadDate ?? '';
  const views = typeof video?.views === 'number' ? video.views : null;

  return (
    <WatchClient
      videoId={videoId}
      title={title}
      channel={channel}
      description={description}
      uploadedAt={uploadedAt}
      views={views}
      transcript={transcript}
    />
  );
}
