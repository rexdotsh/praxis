## Search MVP (/search)

### Goals
- **Surface the best educational YouTube videos** for a topic with a simple, fast flow.
- **Minimal UI**: collapsible sidebar, single input that becomes sticky at the top after submit, results below.

### User Flow
1. User navigates to `/search`, types a query, presses Enter (no live search).
2. Server refines the query via AI (OpenRouter + Vercel AI SDK) using a lightweight system prompt.
3. Server queries YouTube using `youtube-sr` for top candidates with metadata.
4. Server asks AI to select the best 5 videos for learning (ranked) with brief reasons.
5. Client shows the 5 picks as cards (thumbnail, title, channel, duration, reason) with a primary action (Select) for later workflows.

### Architecture
- **Pipeline location**: start with a Next.js API route `app/api/search/route.ts` for low-latency compute and easy iteration.
- **AI**: OpenRouter models via Vercel AI SDK (`ai`, `@ai-sdk/openai`) for swappable models and consistent ergonomics.
- **YouTube**: `youtube-sr` for search; keep transcripts via `lib/youtube/transcript.ts` for later learning features (not used in the MVP flow).

### UI Spec
- **Input behavior**: centered input initially; on submit, transitions to a sticky top bar showing the final submitted query. Another Enter re-runs the flow.
- **Layout**: uses existing `AppSidebar` (collapsible). Results grid/list below sticky input.
- **States**: loading skeletons while searching; toast on error; prior results remain visible on subsequent searches until replaced.

### API Contract
- **Request**: `{ query: string }`
- **Response**:
  - `refinedQuery: string`
  - `picks: Array<{ id: string; title: string; url: string; channel: string; durationMs?: number; views?: number; thumbnailUrl?: string; reason: string }>`
  - `candidatesCount: number`

### Ranking Criteria (AI instruction highlights)
- Optimize for: topical relevance, pedagogical clarity, production quality, and recency when helpful.
- Prefer videos with chapters, strong explanations, examples, and titles/descriptions aligned with the refined query.
- Enforce diversity: avoid near-duplicates; at most one per channel unless uniquely valuable.

### Prompts (v1)
- **Refinement system**: “You are an expert learning coach. Rewrite user queries for YouTube search to maximize educational relevance and clarity. Keep it concise; no punctuation if unnecessary.”
- **Refinement user**: `User query: "{query}". Return only the improved search query.`
- **Selection system**: “You are an educational curator. Given a refined topic and a list of YouTube candidates with metadata, pick the top 5 videos that best teach the topic. Balance clarity, relevance, quality, and diversity (limit one per channel unless unique). Provide very short reasons (<=140 chars). Return strict JSON.”
- **Selection user (inputs)**: `{ refinedQuery, candidates: Array<{ id, title, url, channel, durationMs, views, thumbnailUrl }> }`
- **Selection output JSON shape**:
  ```json
  { "picks": [
    { "id": "string", "reason": "string (<=140 chars)" }
  ]}
  ```

### Candidate Fetch Strategy
- `youtube-sr.search(refinedQuery, { limit: 25, safeSearch: true })`.
- Keep only fields needed by the model to minimize token usage.
- Strip emojis/URL tracking params; normalize channel names; include duration (ms) and basic view count if available.

### Validation & Safety
- Validate refined query as non-empty.
- Validate AI JSON safely; fall back to top-N heuristics if parsing fails.
- SafeSearch enabled by default; we can later expose a toggle.

### Telemetry (later)
- Log query, refinedQuery, candidate count, model latency, chosen IDs, and user clicks (to Convex) for future ranking.

### Performance & Cost Controls
- Cap candidates at 25 and truncate long titles/descriptions before sending to AI.
- Use a small reasoning budget: request only IDs + short reasons from AI.
- Consider caching refinedQuery -> picks for a short TTL keyed by query string.

### Why API Route for MVP (not Convex yet)
- Pure compute with no persistence; fewer moving parts, lower latency. We’ll add Convex when we need session storage, personalization, scheduled enrichment, or durable logging.

### Future Milestones (after MVP)
- Persist searches, picks, and feedback (likes/skips) in Convex for personalization.
- Fetch transcripts to score pedagogical quality and to power quizzes/flashcards.
- Topic-specific rerankers (code, math, language) and length/channel filters.
- Session library: allow saving and revisiting search sessions.

### Open Questions
- Hard diversity constraint in code vs. soft in prompt?
- Recency bias default for fast-moving domains?
- Should we bias towards videos with chapters automatically?

## Persistence (Convex)

We will persist the user’s chosen video for a given search so we can build study workflows later and personalize ranking.

### Tables
- `users`
  - `clerkUserId: string` (unique index)
  - `name: string`

- `searches`
  - `userId: Id<'users'>`
  - `query: string` (raw user query)
  - `refinedQuery: string`
  - `candidatesCount: number`
  - Indexes
    - `by_user_and_time` = [userId, _creationTime]

- `videos`
  - Canonical catalog of videos we touch (dedupe by `youtubeId`).
  - `youtubeId: string` (unique index)
  - `title: string`
  - `url: string`
  - `channel: string`
  - `durationMs?: number`
  - `views?: number`
  - `thumbnailUrl?: string`
  - Indexes
    - `by_youtubeId` = [youtubeId]

- `selections`
  - A user’s pick for a search.
  - `userId: Id<'users'>`
  - `searchId: Id<'searches'>`
  - `videoId: Id<'videos'>`
  - `reason?: string` (AI reason shown to user at selection time)
  - Indexes
    - `by_user_and_time` = [userId, _creationTime]
    - `by_search` = [searchId]

### Functions (Convex new syntax)
- `mutations.createSearch`
  - args: `{ query: string, refinedQuery: string, candidatesCount: number }`
  - returns: `{ searchId: Id<'searches'> }`

- `mutations.upsertVideo`
  - args: `{ youtubeId: string, title: string, url: string, channel: string, durationMs?: number, views?: number, thumbnailUrl?: string }`
  - returns: `{ videoId: Id<'videos'> }`

- `mutations.createSelection`
  - args: `{ searchId: Id<'searches'>, videoId: Id<'videos'>, reason?: string }`
  - returns: `null`

- `queries.listSelectionsByUser`
  - args: `{}` (derive user from auth)
  - returns: latest N selections with joined video metadata and query strings.

### Integration pattern
- Keep the compute-heavy search pipeline in the API route.
- When the client confirms a pick, call Convex mutations:
  1) `createSearch` (if not already created for this run; or pass an id from the API response)
  2) `upsertVideo`
  3) `createSelection`

This splits responsibilities: API route for fast external calls + AI; Convex for durable storage, indexes, and later analytics/feeds.


