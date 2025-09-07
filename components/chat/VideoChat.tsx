'use client';

import { Fragment, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Message, MessageContent } from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputButton,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input';
import { Actions, Action } from '@/components/ai-elements/actions';
import { Response } from '@/components/ai-elements/response';
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from '@/components/ai-elements/sources';
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning';
import { Loader } from '@/components/ai-elements/loader';
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion';
import { CopyIcon, GlobeIcon } from 'lucide-react';
import { getWindowByMinutes } from '@/lib/transcript/window';
import type { TranscriptItem } from '@/lib/youtube/transcript';
import { useVideoPlayer } from '@/components/player/VideoPlayerProvider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ChaptersList from './ChaptersList';
import PomodoroTimer from '@/components/study/PomodoroTimer';

type Props = {
  transcript: TranscriptItem[] | null;
  suggestions: string[];
  chapters: Array<{ title: string; startMs: number }>;
  chaptersSource?: 'description' | 'transcript' | null;
  title?: string;
  description?: string;
  channel?: string;
};

const models = [
  { name: 'GPT 5 Chat', value: 'openai/gpt-4.1-mini' },
  { name: 'Claude Sonnet 4', value: 'anthropic/claude-sonnet-4' },
];

const CONTEXT_MINUTES = [5, 10, 15, 20, 25, 30] as const;

export default function VideoChat({
  transcript,
  suggestions,
  chapters,
  chaptersSource,
  title,
  description,
  channel,
}: Props) {
  const [input, setInput] = useState('');
  const [model, setModel] = useState<string>(models[0].value);
  const [webSearch, setWebSearch] = useState(false);
  const [contextMinutes, setContextMinutes] = useState<number>(10);
  const player = useVideoPlayer();
  const { messages, sendMessage, status } = useChat();
  const [view, setView] = useState<'chat' | 'chapters' | 'study'>('chat');

  const minPastMs = 5 * 60 * 1000;
  const hasFiveMinutesPlayed = player.currentTimeMs >= minPastMs;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    const contextText = getWindowByMinutes(
      transcript ?? [],
      player.currentTimeMs,
      contextMinutes,
    ).text;

    sendMessage(
      { text },
      {
        body: {
          model,
          webSearch,
          transcriptContext: contextText,
          contextSpec: { type: 'minutes', value: contextMinutes },
          chapters,
          meta: { title, description, channel },
        },
      },
    );
    setInput('');
  };

  const handleSuggestionClick = (s: string) => {
    const contextText = getWindowByMinutes(
      transcript ?? [],
      player.currentTimeMs,
      contextMinutes,
    ).text;

    sendMessage(
      { text: s },
      {
        body: {
          model,
          webSearch,
          transcriptContext: contextText,
          contextSpec: { type: 'minutes', value: contextMinutes },
          chapters,
          meta: { title, description, channel },
        },
      },
    );
  };

  return (
    <div className="flex h-full flex-col">
      {!transcript && (
        <div className="mb-2 rounded border border-destructive/50 bg-destructive/10 p-2 text-sm">
          Transcript unavailable for this video. For best results, choose
          another video with captions.
        </div>
      )}
      <Tabs
        value={view}
        onValueChange={(v) => setView(v as 'chat' | 'chapters' | 'study')}
        className="mb-2 w-fit"
      >
        <TabsList>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="chapters">Chapters</TabsTrigger>
          <TabsTrigger value="study">Study Modes</TabsTrigger>
        </TabsList>
      </Tabs>
      {view === 'chat' ? (
        <>
          <Conversation className="h-full">
            <ConversationContent>
              {messages.map((message) => (
                <div key={message.id}>
                  {message.role === 'assistant' &&
                    message.parts.filter((p) => p.type === 'source-url')
                      .length > 0 && (
                      <Sources>
                        <SourcesTrigger
                          count={
                            message.parts.filter((p) => p.type === 'source-url')
                              .length
                          }
                        />
                        {message.parts
                          .filter((p) => p.type === 'source-url')
                          .map((part, i) => (
                            <SourcesContent key={`${message.id}-${i}`}>
                              <Source href={part.url} title={part.url} />
                            </SourcesContent>
                          ))}
                      </Sources>
                    )}
                  {message.parts.map((part, i) => {
                    switch (part.type) {
                      case 'text':
                        return (
                          <Fragment key={`${message.id}-${i}`}>
                            <Message from={message.role}>
                              <MessageContent>
                                <Response>{part.text}</Response>
                              </MessageContent>
                            </Message>
                            {message.role === 'assistant' &&
                              message.id === messages.at(-1)?.id && (
                                <Actions className="mt-2">
                                  <Action
                                    onClick={() =>
                                      navigator.clipboard.writeText(part.text)
                                    }
                                    label="Copy"
                                  >
                                    <CopyIcon className="size-3" />
                                  </Action>
                                </Actions>
                              )}
                          </Fragment>
                        );
                      case 'reasoning':
                        return (
                          <Reasoning
                            key={`${message.id}-${i}`}
                            className="w-full"
                            isStreaming={
                              status === 'streaming' &&
                              i === message.parts.length - 1 &&
                              message.id === messages.at(-1)?.id
                            }
                          >
                            <ReasoningTrigger />
                            <ReasoningContent>{part.text}</ReasoningContent>
                          </Reasoning>
                        );
                      default:
                        return null;
                    }
                  })}
                </div>
              ))}
              {status === 'submitted' && <Loader />}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <div className="mt-3">
            <Suggestions>
              {suggestions.map((s) => (
                <Suggestion
                  key={s}
                  onClick={() => handleSuggestionClick(s)}
                  suggestion={s}
                />
              ))}
            </Suggestions>
          </div>

          <PromptInput onSubmit={handleSubmit} className="mt-2">
            <PromptInputTextarea
              onChange={(e) => setInput(e.target.value)}
              value={input}
            />
            <PromptInputToolbar>
              <PromptInputTools>
                <PromptInputButton
                  variant={webSearch ? 'default' : 'ghost'}
                  onClick={() => setWebSearch(!webSearch)}
                >
                  <GlobeIcon size={16} />
                  <span>Search</span>
                </PromptInputButton>
                <PromptInputModelSelect
                  onValueChange={(v) => setModel(v)}
                  value={model}
                >
                  <PromptInputModelSelectTrigger>
                    <PromptInputModelSelectValue />
                  </PromptInputModelSelectTrigger>
                  <PromptInputModelSelectContent>
                    {models.map((m) => (
                      <PromptInputModelSelectItem key={m.value} value={m.value}>
                        {m.name}
                      </PromptInputModelSelectItem>
                    ))}
                  </PromptInputModelSelectContent>
                </PromptInputModelSelect>
                {/* Context window selector */}
                <PromptInputModelSelect
                  onValueChange={(v) => setContextMinutes(Number(v))}
                  value={String(contextMinutes)}
                  disabled={!hasFiveMinutesPlayed}
                >
                  <PromptInputModelSelectTrigger>
                    <PromptInputModelSelectValue
                      placeholder={`${contextMinutes}m`}
                    />
                  </PromptInputModelSelectTrigger>
                  <PromptInputModelSelectContent>
                    {CONTEXT_MINUTES.map((m) => (
                      <PromptInputModelSelectItem key={m} value={String(m)}>
                        {m} min
                      </PromptInputModelSelectItem>
                    ))}
                  </PromptInputModelSelectContent>
                </PromptInputModelSelect>
              </PromptInputTools>
              <PromptInputSubmit disabled={!input.trim()} status={status} />
            </PromptInputToolbar>
          </PromptInput>
          {!hasFiveMinutesPlayed && (
            <div className="mt-2 text-xs text-muted-foreground">
              Start the video and watch at least 5 minutes to enable transcript
              context.
            </div>
          )}
        </>
      ) : view === 'chapters' ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <ChaptersList chapters={chapters} chaptersSource={chaptersSource} />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="space-y-4">
            <PomodoroTimer />
          </div>
        </div>
      )}
    </div>
  );
}
