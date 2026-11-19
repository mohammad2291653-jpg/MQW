@AGENTS.md

# MQW — repository instructions

Arabic-first private learning app (Next.js 16, React 19, TypeScript). Work on this codebase in place. Never scaffold a separate app.

## Precedence

Latest explicit owner instruction > observed code and data safety > v3 master directive (owner's private package) > MQW 90 docs (`docs/MQW90.md`) > design system (`docs/DESIGN_SYSTEM.md`) > older v1 specs. Old planning-only text and the old sage/purple palette are superseded.

## Permission boundaries

- Allowed: safe local edits, refactors, tests and local builds.
- Requires explicit owner approval: production DB migrations, deployment, paid services (including Higgsfield), external AI calls, real personal data or photos, secrets in chat or code, and destructive data actions.
- `supabase/proposals/*` are proposals only. Applied migrations in `supabase/migrations/` are immutable.

## Product rules that must not regress

- Five primary destinations only: اليوم / تعلّم / قصري / مساحتي / تقدّمي. MQW 90 lives under My Space at `/evolution`.
- Today has one dominant action: continue learning.
- Learning: attempts are persisted before feedback, retries keep history, review dates are editable.
- Memory Palace: five canonical loci (Entrance, Hallway, Living Room, Kitchen, Library). Never remap them.
- No fake numbers, no default doses, protocols or diagnoses, wellbeing off by default, AI off by default.
- No purple, violet, lavender or mauve in the UI. Body text is solid near-black. Gloss is selective.

## Data

`records` (owner-scoped JSON collections) in SQLite locally and in `mqw_private` PostgreSQL with owner RLS in cloud mode. Add new record types as collections with validation in `src/lib/server/records.ts` (MQW 90: `src/lib/server/evolution.ts`). Do not add tables without an approved migration.

## Verify

```sh
npm run typecheck && npm test && npm run build
MQW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test --trace off   # MQW_CHROMIUM_PATH only when the bundled browser is missing
```

Report exact results. Never claim iPhone/Safari or deployment verification that was not done.
