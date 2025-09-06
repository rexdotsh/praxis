## Quiz system plan (approval needed before implementation)

### Goals
- Add an MCQ quiz feature as an addon to `app/watch/[id]/WatchClient.tsx` and `components/chat/VideoChat.tsx`.
- Generate quizzes from a selectable video window (e.g., last 5/10/15/20/30 minutes or last chapter).
- Use Vercel AI SDK with structured output (Zod) similar to `app/api/chapters/route.ts`.
- Run the quiz entirely in a Shadcn `Dialog` (no page nav), one question per step.
- Persist everything to DB (Convex) including quiz, questions, sessions, answers, results.
- Keep it flexible for future automatic prompts (e.g., “Generate quiz for last chapter”).

### Decisions (from you)
- Auth: all authenticated with Clerk; no anonymous mode.
- Default number of questions: 5; min 3, max 10.
- Choices per question: fixed 4.
- Difficulty: included.
- Placement: VideoChat toolbar.
- Explanations: only on the end results screen; do not show explanations for wrong answers at all.
- Shareable summary: not needed.
- Model: continue with `openai/gpt-4.1-mini` via OpenRouter.
- Treat this as a final product, not MVP.

---

### UX flow
1) Entry point
   - Add a `Quiz` button in the right panel (same column as chat):
     - Proposed placement: within `VideoChat` toolbar next to the `Search` toggle, enabled only when transcript available.
     - Alternative: below Suggestions list as a `Button`.

2) Start dialog (Shadcn `Dialog`)
   - Section: "Quiz setup"
   - Inputs (use `React Hook Form` + Shadcn `Input`/`Select`/`RadioGroup`):
     - Scope: `Last N minutes` OR `Last chapter` (if chapters are available)
     - If `Last N minutes`: selectable values `[5, 10, 15, 20, 30]` (default 10)
     - Number of questions: default 5 (range 3–15)
     - Difficulty (optional): `easy | medium | hard` (default medium)
   - CTA: `Generate quiz`

3) Generation state
   - Show loader (`Loader` or `Skeleton`) while calling `/api/quiz/generate`.

4) Quiz run (still in `Dialog`)
   - One question at a time:
     - Render with `Card`, `Typography`, `RadioGroup` for options, `Button` (Next/Submit)
     - Progress with `Progress` bar and count (e.g., 2/5)
   - On answer submit:
     - POST to `/api/quiz/answer` to persist selection and get correctness & explanation
     - Show correctness state and optional `Alert` or inline highlight
     - CTA to proceed to next question

5) Results (completion step)
   - Show total score, per-question correctness, explanations (collapsible with `Accordion`)
   - Actions: `Retake` (re-generate), `Close`

6) Edge cases
   - Transcript unavailable: disable `Quiz` button with tooltip.
   - Chapters unavailable: hide `Last chapter` option.
   - If context window too short (<30s), prompt to expand to 5 minutes.

Components used (Shadcn): `Dialog`, `Button`, `Card`, `RadioGroup`, `Progress`, `Alert`, `Accordion`, `Typography`, `Skeleton`, `Toast` (via `Sonner`) for non-blocking notifications.

---

### Data model (Convex)
Add tables to `convex/schema.ts`:

1) `quizzes`
   - `createdByUserId: v.id("users")`
   - `videoId: v.id("videos")` (resolve via `videos.by_youtubeId`)
   - `spec: v.object({ type: v.union(v.literal("last_minutes"), v.literal("last_chapter")), value: v.number() })`  // if last_chapter, `value` stores startMs
   - `meta: v.object({ title: v.string(), description: v.optional(v.string()), channel: v.optional(v.string()) })`
   - `numQuestions: v.number()` // default 5; min 3; max 10
   - `choicesCount: v.number()` // fixed 4 for now
   - `difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard"))`
   - `model: v.string()` // e.g., "openai/gpt-4.1-mini"
   - `status: v.union(v.literal("draft"), v.literal("active"), v.literal("archived"))` (default `active`)
   - Indexes: `by_video` on `["videoId", "_creationTime"]`, `by_user` on `["createdByUserId", "_creationTime"]`

2) `quiz_questions`
   - `quizId: v.id("quizzes")`
   - `prompt: v.string()`
   - `options: v.array(v.string())` (default 4 choices, support 3–8)
   - `correctIndex: v.number()`
   - `explanation: v.optional(v.string())`
   - Indexes: `by_quiz` on `["quizId", "_creationTime"]`

3) `quiz_sessions`
   - `quizId: v.id("quizzes")`
   - `userId: v.id("users")`
   - `status: v.union(v.literal("in_progress"), v.literal("completed"))`
   - `startedAtMs: v.number()`
   - `finishedAtMs: v.optional(v.number())`
   - Indexes: `by_quiz` on `["quizId", "_creationTime"]`, `by_user` on `["userId", "_creationTime"]`

4) `quiz_answers`
   - `sessionId: v.id("quiz_sessions")`
   - `questionId: v.id("quiz_questions")`
   - `selectedIndex: v.number()`
   - `isCorrect: v.boolean()`
   - Indexes: `by_session` on `["sessionId", "_creationTime"]`, `by_question` on `["questionId", "_creationTime"]`

Notes:
- Do not send `correctIndex` or correctness to the client during the quiz flow. Only reveal at results time; include explanations for wrong answers.
- All sessions are tied to an authenticated user; no anonymous `sessionKey`.

---

### Convex functions (files: `convex/quizzes.ts`)
Follow new function syntax with validators and returns.

- `createQuiz`: mutation
  - args: `{ videoId, createdByUserId, spec, meta, numQuestions, choicesCount, difficulty, model }`
  - returns: `v.id("quizzes")`
  - inserts quiz row

- `saveQuestions`: internalMutation
  - args: `{ quizId, questions: v.array(v.object({ prompt, options, correctIndex, explanation })) }`
  - returns: `v.null()`
  - inserts `quiz_questions`

- `createSession`: mutation
  - args: `{ quizId, userId }`
  - returns: `v.id("quiz_sessions")`

- `getNextQuestion`: query
  - args: `{ quizId, sessionId, userId }`
  - auth check that session belongs to user; returns next unanswered question (sanitized: no `correctIndex`)

- `submitAnswer`: mutation
  - args: `{ sessionId, questionId, selectedIndex, userId }`
  - returns: `{ acknowledged: v.boolean(), progress: v.object({ answered: v.number(), total: v.number() }) }`
  - writes `quiz_answers`; DOES NOT reveal correctness or `correctIndex`

- `getSessionResults`: query
  - args: `{ sessionId, userId }`
  - returns: `{ total, correct, details: Array<{ questionId, prompt, options, selectedIndex, isCorrect, // optional explanation ONLY if isCorrect === false }>} `

- `finishSession`: mutation
  - args: `{ sessionId, userId }`
  - marks session completed and sets `finishedAtMs`

---

### API routes (Next.js app router)
Implement with Vercel AI SDK, then persist via Convex mutations. All routes require Clerk auth; resolve `users` row by Clerk subject (create on first seen) and pass `userId` to Convex.

1) `POST /api/quiz/generate`
   - Input: `{ youtubeId, model, transcriptContext: string, contextSpec: { type: 'minutes' | 'chapter', value: number }, numQuestions?: number (default 5; min 3; max 10), choicesCount?: 4 (ignored if != 4), difficulty?: 'easy' | 'medium' | 'hard', meta?: { title?, description?, channel? } }`
   - Flow:
     - Build prompt using `transcriptContext` similar to `app/api/chapters/route.ts`.
     - Call `generateObject` with schema `QuizGenerationSchema` (see below).
     - Resolve `videoId` from `youtubeId` (create if missing) and `userId` from Clerk.
     - Create quiz via `convex.quizzes.createQuiz`, then `saveQuestions`.
     - Create session via `convex.quizzes.createSession` for the authenticated user.
   - Output: `{ quizId, sessionId, questions: Array<{ id, prompt, options }>, total }` (no answers, no correctness)

2) `POST /api/quiz/answer`
   - Input: `{ sessionId, questionId, selectedIndex }`
   - Calls `convex.quizzes.submitAnswer` with `userId`
   - Output: `{ acknowledged: true, progress: { answered, total } }` (no correctness or explanation)

3) `GET /api/quiz/session?sessionId=...`
   - Returns quiz state for resume (for the authenticated user): `questions (sanitized), answered map, answered count`

4) `POST /api/quiz/finish`
   - Marks session completed and returns final results from `getSessionResults`.
   - Results include explanations for wrong answers (show correct option and explanation for those only).

Security & state:
- Clerk-protected endpoints; map Clerk subject to `users` row.
- Rate-limit generation per user+video (optional future enhancement).

---

### Vercel AI structured output
Schema (Zod) for generation, inspired by `app/api/chapters/route.ts` usage:

```ts
const QuizGenerationSchema = z.object({
  questions: z.array(z.object({
    id: z.string().optional(), // will generate server-side if absent
    prompt: z.string(),
    options: z.array(z.string()).min(3).max(8),
    correctIndex: z.number().int().nonnegative(),
    explanation: z.string().optional(),
  })).min(3).max(15),
});
```

Prompting guidance:
- “Create concise, unambiguous MCQs based strictly on the provided transcript window. Avoid outside knowledge unless obviously general. Options should be mutually exclusive. Include short explanation for the correct answer.”

---

### Computing transcript context
- Reuse `getWindowByMinutes(transcript, player.currentTimeMs, minutes)` from `VideoChat`.
- For `Last chapter`, pick the latest chapter whose `startMs` ≤ `player.currentTimeMs`; gather transcript between that chapter start and now (cap size to ~2000–3000 tokens by truncating older items if needed).

---

### UI wiring details
- `VideoChat` additions:
  - Add `Quiz` button in toolbar; opens `Dialog` controlled by component state.
  - Step 1 (setup form), Step 2 (generating), Step 3 (quiz run), Step 4 (results).
  - Use `Toast` to surface non-blocking errors and background notifications (e.g., suggestion to try quiz for last chapter).
  - During quiz: on submit, advance to next question without revealing correctness; disable back navigation to previous questions to meet no-spoilers expectation.

Accessibility & styles:
- Shadcn defaults only; no hardcoded colors.
- Keyboard navigation: arrow keys for `RadioGroup`, Enter to submit.

---

### Analytics & persistence details
- Store per-answer latency (ms) client-side, optionally include when submitting (future).
- Save whether user viewed explanation (future).
- Allow re-generation as a new quiz (new quiz row) or a new session on the same quiz (configurable).

---

### Future automation hook
- Trigger toast after chapter ends: “Generate a 5-question quiz for the last chapter?”
- One-click: pre-fills dialog with `Last chapter` and default count.

---

### Remaining question (clarify before build)
1) On the results screen, for questions answered incorrectly, should we show the correct option (without explanation) or hide it entirely and only show score? (You said no explanations for wrong answers; confirming visibility of the correct answer.)

---

### Acceptance criteria (final)
- Quiz button visible when transcript is available; in `VideoChat` toolbar.
- Dialog-driven flow: setup → generating → quiz → results.
- Structured output used for generation; persisted to Convex.
- During quiz: no correctness or explanations are revealed.
- Results screen: show score and per-question correctness; include explanations for wrong answers.
- All data saved with user association (Clerk), including quiz, session, answers, and results.
- Sessions can be resumed until finished; once finished, marked completed.


