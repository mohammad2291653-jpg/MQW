# MQW 90 — My Evolution

A private, optional 90-day module inside My Space. It sits beside the learning flagship (lessons, reviews, Memory Palace) and does not replace it.

## Navigation

The five primary destinations are unchanged. MQW 90 is a section of **مساحتي**:

- Entry block on **اليوم** (`/today`) and a fixed entry on **مساحتي** (`/space`).
- Hub `/evolution` with its own nested navigation. The sidebar highlights مساحتي.

| Route | Purpose |
|---|---|
| `/evolution/onboarding` | Start date + time zone, 1–3 goals, pillar selection, privacy summary, draft |
| `/evolution` | Day N of 90, phases (1–30 / 31–60 / 61–90), Daily Compass, actually-scheduled items, pillar entries |
| `/evolution/skin` · `/evolution/skin/agency` | Face product log, usage, observations, private photos + manual compare · separate commercial evaluation |
| `/evolution/hair` | Scalp / beard toggle (separate records + photos), clinician-established microneedling log |
| `/evolution/supplements` | Catalog, flexible schedules (daily / weekdays / every N days / as needed), taken/skipped/postponed/n.a. |
| `/evolution/fitness` · `/evolution/fitness/session/:id` | PPL templates, exercise library, set logging, interrupt/resume, rest days, trends, optional body metrics |
| `/evolution/wellbeing` | Off by default; opt-in check-ins (1–5), masked private journal, breathing timer |
| `/evolution/balance` · `/evolution/weekly` | User-chosen domains; 5-minute weekly review with one next action |
| `/evolution/report` | Factual counts per cycle with date windows and denominators; Day 1/30/60/90 reflections |
| `/evolution/settings` | Goals, pillar visibility, start date, pause/resume/complete/archive, export, per-pillar deletion |

## Data and storage

**No schema migration was needed.** All structured data is stored in the existing owner-scoped `records` table (SQLite locally, `mqw_private.records` with owner RLS in PostgreSQL) under these collections:

`evoCycles, evoDaily, evoProducts, evoRoutineEvents, evoObservations, evoAgencyReviews, evoSupplements, evoIntakes, evoExercises, evoTemplates, evoWorkouts, evoRestDays, evoMetrics, evoWellbeing, evoJournal, evoWeekly, evoMilestones, evoPhotos` (photos: metadata only, written via the media route).

As a result, MQW 90 inherits server-side ownership checks on every object, PostgreSQL owner RLS, account-deletion cascades and export inclusion.

Validation lives in `src/lib/server/evolution.ts`. Deterministic date and recurrence maths lives in `src/lib/evolution.ts` and is shared by client and server.

### Invariants enforced by the server

- Only one open (draft/active/paused) cycle at a time. Archived cycles are read-only, and restarting creates a new cycle.
- Day 1 = start date, Day 90 = start + 89. Calendar-string arithmetic is DST-safe. Pausing does not change day numbers or photo dates.
- At most 3 goals.
- **No defaults for any dose, strength or frequency.** Product and supplement fields store only user-entered text.
- Microneedling events require `pillar = hair` and `clinicianEstablished = true`. There is no protocol, depth or frequency anywhere.
- Wellbeing check-ins and journal entries are rejected unless the owner enabled the wellbeing pillar.
- Duplicate-safe writes: same-day compass, intake (supplement + date + time), weekly review, milestone and wellbeing check-in update the existing record rather than creating a duplicate.
- Editing a supplement schedule appends a new version from today. Earlier intakes keep their `scheduleVersion`.
- Workouts snapshot exercise names. Deleting or renaming an exercise does not rewrite history, and a completed session cannot be reopened.
- References (product, supplement, exercise, template, cycle) are verified to belong to the same owner when set or changed.

### Private photos

- **Local/SQLite mode:** bytes go to `DATA_DIR/media/<owner>/<id>` with mode 0600, streamed only through `GET /api/evolution/photos/:id` after authentication and an owner check. Responses send `Cache-Control: private, no-store`, `nosniff` and `CORP same-origin`. There is no public URL.
- **Metadata hygiene:** the browser re-encodes to JPEG (max 2048 px). The server sniffs the magic bytes (JPEG/PNG only) and independently strips JPEG APP1–APP13/APP15/COM segments and PNG text/time/EXIF chunks. Upload file names are neutral.
- **Limits:** 8 MiB per photo, 300 MiB per account, one upload at a time, rate-limited, same-origin only.
- Included in export (`photoFiles`, base64) and in the SQLite backup tool (`media/…`). Account deletion tombstones the folder with durable cleanup retry. Per-pillar deletion removes the files.
- **Cloud/PostgreSQL mode: photos are disabled** (HTTP 501, with an explanation shown in the UI). A reviewed proposal exists at `supabase/proposals/mqw90_private_media.sql`. It is **not applied**.

## Clinical and privacy boundaries (product copy)

- Tracking only; nothing is prescribed. Minoxidil concentration and dose are copied from the product or a clinician. Beard use may be off-label. Microneedling is logged only as clinician-established sessions, with a visible risk note.
- Supplement interactions are mentioned only as a prompt to consult a pharmacist or doctor. No inferred deficiencies.
- Recording irritation shows a calm, non-prescriptive note suggesting a pause, checking the label or consulting a professional.
- Wellbeing is not therapy, diagnosis or emergency support. It shows a crisis note pointing to local emergency services. There is no mood chart, no mood preview on the overview, journal entries are masked until opened, and nothing is computed from other behaviour.
- The report shows counts with windows and denominators only. There is no transformation score, no wellness index and no failure framing for rest days.
- Commercial evaluation is a separate route with no access to photos or personal observations, and no sharing button.
- No AI or external calls. No background notifications are claimed.

## Production gate (requires owner approval)

1. Enabling photos in cloud mode: apply the proposal migration only after a verified backup and tested restore, then extend `media.ts` and export for PostgreSQL.
2. Deploying this branch: it changes no schema, but it does change the UI and add collections to the running service. Redeployment needs the owner's go-ahead.
3. Any AI provider, paid generation (Higgsfield) or public registration change remains out of scope.

## Tests

- `tests/evolution.test.ts` (unit/integration, SQLite): cycle maths and DST, recurrence and versioning, volume load, lifecycle and wellbeing opt-in, no-dose and clinician guards, idempotent intakes, PPL snapshots, owner isolation across collections and nested references, EXIF stripping and photo isolation, per-pillar deletion.
- `tests/evolution.e2e.spec.ts` (Chromium): the full user journey with reloads, private photo upload and compare, axe checks on 8 MQW 90 screens, no horizontal overflow at 390 px on 11 routes, per-pillar deletion, and cross-account and anonymous photo access denial.
