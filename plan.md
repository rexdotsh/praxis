# Datesheet/Syllabus Upload & AI Parsing – Full Plan

## Goals
- Enable users to extract structured exam schedules and syllabi from PDFs or images.
- Persist results in Convex; surface on Dashboard with useful at-a-glance info.
- Provide a manual entry fallback, while strongly encouraging AI upload/parse.

## Non-Goals (for v1)
- No multi-user collaboration on the same datesheet.
- No automatic calendar sync (ICS); can be a follow-up.
- No advanced OCR tuning or page-level cropping UI.

## Primary User Flows
1) Upload + Parse (recommended)
   - User visits `/datesheets`.
   - Uploads PDF or image → file goes to Vercel Blob → returns `fileUrl`.
   - Client calls `/api/datesheets/parse` with `fileUrl`.
   - Server uses AI SDK + OpenRouter (Claude Sonnet 4) to extract objects.
   - Client shows editable preview table; user confirms and saves.
   - Persist to Convex; toast success; link back to Dashboard.

2) Manual Entry
   - On `/datesheets`, user chooses “Enter manually”.
   - Client shows a minimal table editor with add/remove rows and validation.
   - Save to Convex; toast success; link back to Dashboard.

3) Dashboard Consumption
   - Dashboard fetches user’s datesheets via Convex query.
   - Display summary: upcoming exam(s), count of subjects, date range.
   - Deep link to view/edit that datesheet from Dashboard.

## Data Model (Convex)
- Table: `datesheets`
  - `userId: v.id('users')`
  - `title: v.string()` – user-facing (e.g., "Term 1 Exams 2025")
  - `sourceType: 'upload' | 'manual'`
  - `fileUrl?: string` – Vercel Blob URL of the original asset if uploaded
  - `items: Array<{ subject: string; examDate: string; startTime?: string; endTime?: string; syllabus: string[] }>`
  - `notes?: string`
- Indexes:
  - `by_user` on `userId`

### Alternative Data Model (consider for v2 if needed)
- Separate table `datesheet_items` for row-level updates and indexing by date/subject.
  - Pros: granular edits, easier querying by date.
  - Cons: more complexity, round-trips. For v1, embedded array is simpler.

## Validation & Normalization Rules
- `title`: 1–120 chars.
- `items`: 1–200 rows.
- `subject`: non-empty, <= 120 chars. Deduplicate by trimmed lowercase when saving.
- `examDate`: must be ISO `YYYY-MM-DD`.
- `startTime`/`endTime`: optional; if present, `HH:MM` 24h.
- `syllabus`: array of non-empty strings, each <= 240 chars.
- Post-process: trim whitespace; collapse repeated spaces; remove duplicate bullets.

## Time & Timezone Strategy
- Store dates as ISO date (no time) and optional times as `HH:MM` strings.
- For Dashboard “upcoming exams”, compare dates using user’s timezone (from browser or a stored profile setting). If none, default to UTC.
- Year inference (parsing PDFs): if the date has no year, infer from doc text (e.g., “2025”) else default to current or next occurrence (configurable; surface a warning in UI if inferred).

## Storage & Uploads (Vercel Blob)
- Client → signed upload URL → direct upload to Blob (best for large files).
- Accept formats: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`.
- Enforce size limit (e.g., 10–25 MB) on server when issuing signed URL.
- Save returned URL; use in `/api/datesheets/parse`.

## AI Extraction
- Provider: OpenRouter via AI SDK; Model: `anthropic/claude-sonnet-4` (vision & PDF capable).
- Input construction:
  - PDF: `content: [{ type: 'text', text: 'Extract a normalized datesheet...' }, { type: 'file', data: new URL(fileUrl), mediaType: 'application/pdf' }]`.
  - Image: `content: [{ type: 'text', ... }, { type: 'image', image: new URL(fileUrl) }]`.
- Output: `generateObject` with strict schema:
  - `{ title?: string, items: Array<{ subject, examDate, startTime?, endTime?, syllabus: string[] }> }`.
- Prompting essentials:
  - Parse across all pages.
  - Normalize dates to ISO `YYYY-MM-DD` and 24h times.
  - Syllabus: extract as concise bullet points; omit irrelevant text (headers, footers, watermarks).
  - Ignore non-exam events (e.g., holidays) unless obviously part of exams.
  - If ambiguous fields exist, make best guess and add a warning string (we can surface in UI).

### Robustness & Fallbacks
- If `generateObject` fails, retry once with: lower temperature, slightly different instruction.
- If still failing, fall back to `generateText` with experimental structured output.
- Surface a UI banner if we had to fallback or inferred the year/time.

### Cost, Latency, and Limits
- PDFs with many pages may be expensive; guide users to upload only the datesheet pages.
- Set max tokens and model-specific reasoning limits (e.g., 2–4k) to keep costs reasonable.
- Add a server timeout (e.g., 30–45s) and instruct the model to be concise.

## API Design
1) `POST /api/blob/upload` (optional; issues signed upload URL)
   - Input: `{ contentType: 'application/pdf' | 'image/*', size?: number }`
   - Output: `{ uploadUrl, url }` (or just signed URL; client will PUT and then use final `url`).

2) `POST /api/datesheets/parse`
   - Input: `{ fileUrl?: string; imageUrl?: string }` (one required).
   - Auth: Clerk session; rate limit (e.g., 10/day) to prevent abuse.
   - Behavior: Choose input type; call AI; return `{ parsed: { title, items }, warnings?: string[] }`.

3) `POST /api/datesheets`
   - Input: `{ title, sourceType: 'upload'|'manual', fileUrl?: string, items, notes? }`.
   - Behavior: Validate/normalize; insert in Convex; return `{ id }`.

4) `GET /api/datesheets` (or Convex query on client)
   - Returns: list of current user’s datesheets with minimal fields for dashboard.

## UI/UX – `/datesheets`
- Structure
  - Server wrapper (auth+onboarding checks), client page for interactions.
  - Left: Upload card (drag & drop, or button). CTA: “Use AI to parse your datesheet (recommended)”.
  - Right: Parsed Preview table with inline edits:
    - Columns: Subject, Date (date picker), Start, End, Syllabus (multi-line bullets per row; compact editor with simple splitting by newline).
    - Add/Delete row; reorder optional (not needed v1).
  - Link below upload: “Prefer manual entry? Add rows yourself.” toggles manual panel.

- Interaction Details
  - After upload completes → show spinner while parsing.
  - On parse success → render parsed preview with a small warnings badge if any.
  - On parse error → show error alert with “Try again”, “Switch to manual”, and link to tips.
  - “Save datesheet” button validates and then persists to Convex.
  - Toast on success; link to dashboard and “View datesheet”.

- Accessibility
  - Keyboard friendly table editing.
  - Proper labels for inputs; error messaging on invalid dates/times.

## Dashboard Enhancements
- Add a “Datesheets” card showing:
  - Count of saved datesheets; CTA “Create new” → `/datesheets`.
  - Next upcoming exam across all datesheets (subject + relative date).
- List recent datesheets with date range (min/max examDate) and subjects count.

## Security & Privacy
- Auth required for all actions.
- Only allow the owner to read/write their datesheets.
- Vercel Blob URLs: avoid making them public in listings beyond the owner; optional: set to private if needed.
- Limit uploads by MIME/size; reject suspicious files.

## Observability
- Log upload/parse attempts (count, duration, model used) with minimal metadata.
- Capture AI failures and reasons for future prompt tuning.

## Testing Plan
- Unit: normalization utils (date/time parsing, dedup, trimming).
- Integration: parse endpoint with a few sample PDFs/images.
- E2E smoke: full flow from upload → parse → save → dashboard.

## Rollout
- Feature flag `datesheetsEnabled` (env or config) if needed.
- Start with smaller file-size limit; raise after monitoring.
- Add a “Help” tooltip with examples of good photos/scans.

## Open Questions
- Timezone source of truth (user profile vs browser detection)?
- Year inference default: current vs next occurrence?
- Do we need to support multiple date formats per locale?

## Task List (high-level)
- Convex: schema + indexes (`datesheets`).
- Convex: mutations/queries (`create`, `listByUser`).
- Upload: signed URL route or direct client helper.
- Parse: API route using AI SDK + OpenRouter; Zod validation; post-processing.
- UI: `/datesheets` page (upload, preview table, manual entry).
- Dashboard: surface summaries and CTA.
- Telemetry: basic logs for attempts and failures.
- QA & linting.
