'use client';

import { createContext, useContext } from 'react';

export type PlayerStatus =
  | 'unstarted'
  | 'playing'
  | 'paused'
  | 'buffering'
  | 'ended'
  | 'cued';

export type VideoPlayerState = {
  videoId: string;
  status: PlayerStatus;
  currentTimeMs: number;
  durationMs: number;
  playbackRate: number;
};

export type VideoPlayerControls = {
  play: () => void;
  pause: () => void;
  seekToMs: (ms: number) => void;
  setPlaybackRate: (rate: number) => void;
};

export type VideoPlayerContextValue = VideoPlayerState & VideoPlayerControls;

const noop = () => {};

const defaultValue: VideoPlayerContextValue = {
  videoId: '',
  status: 'unstarted',
  currentTimeMs: 0,
  durationMs: 0,
  playbackRate: 1,
  play: noop,
  pause: noop,
  seekToMs: noop,
  setPlaybackRate: noop,
};

const VideoPlayerContext = createContext<VideoPlayerContextValue>(defaultValue);

export function useVideoPlayer(): VideoPlayerContextValue {
  return useContext(VideoPlayerContext);
}

type ProviderProps = {
  value: VideoPlayerContextValue;
  children: React.ReactNode;
};

export function VideoPlayerProvider({ value, children }: ProviderProps) {
  return (
    <VideoPlayerContext.Provider value={value}>
      {children}
    </VideoPlayerContext.Provider>
  );
}
