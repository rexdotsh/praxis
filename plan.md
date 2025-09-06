## Watch UI + AI Chat Plan

### Objectives
- Fully replace the current transcript pane with a right-side AI chat powered by AI Elements and AI SDK.
- Integrate YouTube IFrame API to track player state (play/pause/buffer), current time, duration, and playback rate.
- Provide transcript-aware context windows (e.g., last 5/10/15 minutes) when sending prompts.
- Generate AI-based suggestion messages on load from transcript and metadata.
 - Generate chapter markers with AI from the transcript on load; display chapters and feed them into the AI context.

### High-level Architecture
- Server
  - `app/api/chat/route.ts`: streaming chat endpoint using AI SDK + `openrouter` provider; return parts with reasoning and sources.
  - `app/api/suggestions/route.ts`: generate short clickable suggestions from transcript + metadata.
  - Continue best-effort transcript fetching in `lib/youtube/transcript.ts` on the watch page and pass to client.
- Client
  - Player
    - `components/player/YouTubePlayer.tsx`: Client component that loads IFrame API, instantiates `YT.Player`, maps events, and emits time updates.
    - `context/video-player.tsx`: React context exposing player state: currentTimeMs, durationMs, playbackRate, status, and controls.
  - Watch UI
    - `app/watch/[id]/WatchClient.tsx`: Composes the player, video details, and right-side chat panel.
    - Right-side panel is AI Chat (fully replaces Transcript). Responsive: stacks below video on small screens.
  - AI Chat
    - `components/chat/VideoChat.tsx`: Uses AI Elements (`Conversation`, `Message`, `PromptInput`, etc.) and `@ai-sdk/react` `useChat` to stream responses.
    - Supports model picker and optional web search.
    - Injects transcript slice based on selected context window and current player time.
  - Suggestions
    - `components/chat/SuggestionsBar.tsx`: Renders AI Elements `Suggestions`/`Suggestion` with onClick -> sendMessage.
  - Chapters
    - `components/watch/Chapters.tsx`: Displays generated chapters; clicking seeks the player. Chapters are included in AI context.

### YouTube IFrame API Integration
- Replace `@next/third-parties/google` `YouTubeEmbed` with custom player built via IFrame API.
- Implementation details
  - Load once: `lib/youtube/iframe.ts` utility to load `https://www.youtube.com/iframe_api` and await `window.onYouTubeIframeAPIReady`.
  - Create player with `new YT.Player(container, { videoId, playerVars: { ... }, events })`.
  - Track
    - onReady -> duration, initial state.
    - onStateChange -> playing/paused/buffering/ended.
    - Poll `getCurrentTime()` while playing (rAF or interval) and on seek/state transitions.
  - Expose controls: `play()`, `pause()`, `seekTo(ms)`, `setPlaybackRate(rate)`.
  - Provide origin and `enablejsapi=1` (handled by IFrame API) and ensure `host: 'https://www.youtube.com'` where needed.
  - Polling cadence for time updates: 250–500ms while playing; on state/seek transitions emit immediate update.
  - Fallback: if IFrame API load fails, render static embed and disable time-based features.

### Transcript Handling + Context Windows
- Server fetch transcript on page load (as today) and pass to client as prop.
- Client derives slices for context without extra effects:
  - Data model: `TranscriptItem { text, startMs, durationMs, lang? }`.
  - Build derived helpers:
    - `getWindowByMinutes(transcript, currentTimeMs, minutes)` -> joined text capped by token budget.
    - Fallback: entire transcript or last N items if duration unknown.
  - Edge cases: transcript missing -> show a prominent warning in the chat panel and recommend choosing another video; do not attempt alternate sources.
  - No server-side transcript caching.

### AI Chat
- Frontend (AI Elements + AI SDK)
  - Use `Conversation`, `Message`, `Response`, `Reasoning`, `Sources`, `PromptInput` with model picker.
  - Add toolbar: model select (default `openai/gpt-4o-mini` via OpenRouter), optional web search toggle (default off), context window select.
  - Context window options: 5, 10, 15, 20, 25, 30 minutes (max).
  - On submit: compute transcript slice using current `VideoPlayerContext` time; send as `body: { model, webSearch, transcriptContext, contextSpec, chapters }`.
- Backend (AI SDK streaming)
  - `app/api/chat/route.ts` using `streamText` and `convertToModelMessages` to stream UI parts.
  - Use `openrouter.chat(model)`; if `webSearch`, optionally use `perplexity/sonar` for sources.
  - System prompt emphasizes using the provided transcript slice (and chapters) as primary context; cite sources if provided by the model; concise, instructional tone.
  - Reasoning parts shown if provided by the model and supported by UI.

### Suggestions
- API: `app/api/suggestions/route.ts`
  - Input: title, description, (optional) transcript sample (first N chars) and/or outline.
  - Output: array of short, diverse question strings (5 items).
- UI: `Suggestions` row under chat input; click -> `sendMessage({ text: suggestion })`.
- Prefer deterministic, non-duplicative suggestions (temperature ~0.3–0.5) and short phrasing.
 - Generated on watch page load; display loading state until available.

### Watch Page Refactor
- Server page `app/watch/[id]/page.tsx`
  - Keep SSR for metadata + transcript.
  - Render `WatchClient` with props: `videoId`, `meta`, `transcript`.
  - Remove transcript pane and render chat panel instead.
  - Place quick actions below the video (outside chat), e.g., Summarize last N minutes, Explain topic, Make quiz.

### Data/Privacy/Perf
- Only send the selected transcript slice per request to minimize token usage.
- Max transcript context: ~6,000 tokens (≈24k chars) per request; if longer, truncate oldest first within the selected window.
- No PII redaction beyond defaults (as requested). No telemetry needed.

### Failure Handling
- If IFrame API fails, fall back to plain embed and disable time-based context windows.
- If transcript missing, disable context window selector, show a prominent warning, and recommend choosing another video.

### API Contracts
- `POST /api/chat`
  - Request body: `{ messages: UIMessage[], model: string, webSearch?: boolean, transcriptContext?: string, contextSpec?: { type: 'minutes', value: number }, chapters?: Array<{ title: string; startMs: number }> }`
  - Behavior: streams assistant messages; may include `reasoning` and `source-url` parts.
  - Defaults: `model = 'openai/gpt-4o-mini'`, `webSearch = false`.
  - Duration limit: 30s streaming window.
- `POST /api/suggestions`
  - Request body: `{ title: string, description?: string, transcriptSample?: string }`
  - Response: `{ suggestions: string[] }` (5 items).
- `POST /api/chapters`
  - Request body: `{ transcript: TranscriptItem[], preferredCount?: number }`
  - Response: `{ chapters: Array<{ title: string; startMs: number }> }`

### Tasks (Implementation)
1) Implement YouTube IFrame API player with state tracking.
2) Create `VideoPlayerContext` and wire into `WatchClient`.
3) Scaffold AI Elements components (see list below) via CLI.
4) Add `app/api/chat/route.ts` streaming endpoint using AI SDK + `openrouter`.
5) Build `VideoChat` with model picker (default `openai/gpt-4o-mini`), optional web search toggle, and context window selector (5–30 mins).
6) Implement transcript slicing helpers and integrate into message submit; enforce max token budget.
7) Add suggestions endpoint + `SuggestionsBar`; load on watch page mount; show loading state.
8) Add chapters endpoint and `Chapters` component; clicking seeks player and enriches AI context.
9) Replace transcript pane with chat and quick actions below the video.
10) Lint and fix errors.

### Dependencies/Setup
- Ensure `@ai-sdk/react` is installed; use Bun (bun.lock present).
- Run AI Elements CLI to add components (Bun): `bunx --bun ai-elements@latest add <component>`.
- Confirm `OPENROUTER_API_KEY` exists (already used by `lib/ai.ts`). Optionally support Vercel AI Gateway.

### Stretch/Future
- “Jump to answer” timestamps from responses (extract timestamps and seek player).
- Auto-summarize last N minutes on pause.
- Save chat threads per video to Convex.

### Convex Schema (proposed)
- `video_chats`
  - `videoId: string` (YouTube ID)
  - `userId?: Id<'users'>`
  - `model: string`
  - `createdAt: number`
  - Index: by `videoId`
- `video_chat_messages`
  - `chatId: Id<'video_chats'>`
  - `role: 'user' | 'assistant' | 'system'`
  - `content: string` (flattened text for now)
  - `contextSpec?: { type: 'minutes'; value: number }`
  - `transcriptStartMs?: number`
  - `transcriptEndMs?: number`
  - `_creationTime: number`
  - Index: by `chatId`
- `video_suggestion_clicks`
  - `videoId: string`
  - `suggestion: string`
  - `_creationTime: number`
  - Index: by `videoId`

### Acceptance Criteria
- Watch page shows responsive right-side chat panel (or stacked on small screens) with AI Elements UI.
- Player state (time, status) is tracked; context selector offers 5–30 minute options.
- Missing transcript shows a clear warning and disables context selector; chat still works with metadata.
- Suggestions (5) appear on load under input; clicking sends a prompt.
- Chapters are generated on load and displayed; clicking seeks the player; chat can reference chapters.
- Chat streams responses, optionally shows reasoning, and can toggle web search.
- All requests only include the selected transcript slice and respect the max context size.
- Chats and messages (with contextSpec) are saved in Convex; suggestion clicks are recorded.

### AI Elements Components to Add (via CLI)
conversation, message, prompt-input, response, reasoning, sources, loader, actions, suggestion
