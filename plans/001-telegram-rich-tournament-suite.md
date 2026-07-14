# Plan 001: Ship the Telegram rich tournament suite

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If a STOP condition occurs, stop and report instead of improvising. Keep unrelated dirty files out of commits.
>
> **Drift check (run first)**: `git diff --stat 5f1b02d..HEAD -- prisma/schema.prisma src/lib/telegram-bot.ts src/lib/telegram-format.ts src/lib/services/notifications.ts src/lib/services/tournaments.ts src/app/api/telegram/webhook/route.ts src/app/api/admin/broadcasts/route.ts src/components/admin/telegram-broadcast-form.tsx src/components/admin/tournament-builder-form.tsx`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `5f1b02d`, 2026-07-14

## Why this matters

The platform already links Telegram accounts, sends individual notifications, broadcasts HTML messages, calculates standings, generates schedules, and exports tournament images. Telegram Bot API 10.2 adds structured rich messages, tables, inline media, long content, editable rich posts, and private ephemeral group replies. Combining those capabilities removes manual copy/paste for organizers and gives players clearer match, deadline, standings, and result communication.

## Current state

- `src/lib/telegram-bot.ts:218` sends legacy `sendMessage`; `:255` sends one media item. It has no rich-message, edit, callback-button, or ephemeral API.
- `src/lib/telegram-format.ts:1` hard-codes the legacy 4096-character text limit and sanitizes legacy Telegram HTML.
- `src/components/admin/telegram-broadcast-form.tsx:202` provides a manual HTML composer and preview.
- `src/app/api/admin/broadcasts/route.ts:207` sends every broadcast to every linked Telegram user with no tournament audience selector.
- `src/lib/services/notifications.ts:129` converts every notification to the same legacy HTML card.
- `src/lib/services/tournaments.ts:905` already has personalized deadline data and `:1000` has personalized match-ready data.
- `src/app/api/telegram/webhook/route.ts:78` handles only `/start`; webhook registration allows only `message` updates.
- `src/components/admin/tournament-image-exporter.tsx:580` already renders schedule and standings image exports in the browser.
- `prisma/schema.prisma:637` stores tournament data but no Telegram community/channel/group destination or published message IDs.

Repository conventions: TypeScript strict mode, Next.js App Router route handlers, Prisma/PostgreSQL, Zod boundary validation, Tailwind/shadcn-style UI components, `tsx --test` colocated `*.test.ts` files, and direct `fetch` wrappers for external APIs.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Prisma client | `npx prisma generate` | exit 0 |
| Focused tests | `npx tsx --test src/lib/telegram-rich.test.ts src/lib/telegram-publications.test.ts` | all pass |
| Full tests | `npm test` | all pass |
| Typecheck | `npx tsc --noEmit` | exit 0, no errors |
| Lint | `npm run lint` | exit 0, or document the repository's pre-existing Next 15 lint-script incompatibility |
| Build | `npm run build` | exit 0 |

## Suggested executor toolkit

- Use the `ui-ux-pro-max` skill for the admin composer: dark OLED-compatible surfaces, semantic status colors, visible labels and focus rings, 44px touch targets, responsive 375px layout, loading/submit feedback, and Lucide icons rather than emoji UI icons.
- Use Telegram's official Bot API documentation for rich-message payload field names. Preserve a legacy HTML fallback when rich delivery is rejected or unavailable.

## Scope

**In scope**:

- Prisma schema and migration for tournament Telegram destinations and publication state.
- Telegram API adapter, rich block builders, template generation, notifications, broadcasts, webhook commands, and publication synchronization.
- Admin tournament destination controls and redesigned broadcast composer with templates, audience selection, and preview.
- Tests for pure rich-message/template/audience logic.
- Minimal README environment/config documentation.

**Out of scope**:

- Publishing raw player evidence screenshots without explicit moderation/consent.
- Accepting irreversible match results directly from unsigned Telegram callbacks; buttons must use authenticated site/deep links.
- Replacing the existing website notification records or public tournament UI.
- Committing unrelated existing changes under `.agents/`, `.claude/`, `.codex/`, `.mcp.json`, `public/manifest.webmanifest`, `AGENTS.md`, `.dockerignore`, or `skills-lock.json`.

## Git workflow

- Branch: `feat/telegram-rich-tournaments` from `5f1b02d` / current `origin/main`.
- Commit messages follow the repository's imperative style, e.g. `Add Telegram rich tournament suite`.
- Push the feature branch, open a PR, verify it, merge through GitHub into `main`, then verify the configured deployment. Never commit directly to `main`.

## Steps

### Step 1: Add failing tests for structured Telegram templates

Create pure tests that require: a 32,768-character rich limit; tournament announcement blocks containing heading, facts table, rules/details, cover media, and CTA; personal match cards containing opponent/deadline fields; standings/schedule tables that truncate safely; deterministic content hashing; and audience selection for all linked users, tournament participants, a group, applicants, and unresolved-match players.

**Verify**: focused tests fail because the new builders do not yet exist.

### Step 2: Add rich-message transport with legacy fallback

Add typed Bot API request helpers for `sendRichMessage`, `editMessageText` with a rich payload, callback and URL keyboards, and receiver-scoped ephemeral delivery. Keep `sendTelegramMessage` and media methods intact. Return Telegram message IDs from send/edit methods. Centralize error parsing and expose an unsupported-rich-message predicate for fallback.

**Verify**: transport/builder tests pass; TypeScript compiles.

### Step 3: Model destinations and live publications

Add optional community/channel/group IDs to `Tournament` and a `TelegramPublication` model keyed by tournament, destination, and kind, storing message ID and content hash. Add a timestamped Prisma migration and regenerate the client.

**Verify**: `npx prisma validate` and `npx prisma generate` exit 0.

### Step 4: Build tournament rich templates and audience resolution

Create server-side builders for announcement, registration, schedule, standings, round recap, result card, completion, and personal match/deadline messages. Tables must remain readable on narrow clients, large datasets must be capped with a link to the full site, and user-provided text must be treated as data rather than markup. Add audience resolvers for all linked users, participants, group, pending applicants, and unresolved-match players.

**Verify**: new focused tests pass with exact structural assertions and injection-safe text.

### Step 5: Upgrade the admin experience

Redesign the broadcast composer into responsive sections: content source/manual-vs-tournament, template, tournament, audience, optional group, structured content, media, CTA buttons, and a phone-like preview. Add explicit loading/success/error feedback, accessible labels, keyboard focus, touch-sized controls, and progressive disclosure. Add tournament Telegram destination fields and a publish-on-status-change option to the tournament builder/edit flow.

**Verify**: typecheck passes; inspect at 375px and desktop; no horizontal page overflow.

### Step 6: Wire automatic publications and live bulletin updates

On registration opening, stage/round activation, deadline changes, confirmed results, standings recalculation, and tournament completion, build rich posts for configured destinations. Use the publication table and content hash to edit an existing bulletin only when content changed; recreate it when Telegram reports the stored message cannot be edited. Existing direct notifications remain durable website records and gain richer Telegram rendering.

**Verify**: tests cover unchanged-hash skip, edit, missing-message recreate, and legacy fallback.

### Step 7: Add the community match assistant

Expand webhook update registration and handling for `/mymatch`, `/deadline`, `/table`, `/schedule`, and `/rules`. Resolve the caller through `telegramId`, resolve the tournament through configured group/community destination, and send receiver-scoped ephemeral messages in group contexts. Never fall back to a public message for private commands; provide safe private-chat behavior and signed/authenticated site links for actions.

**Verify**: handler tests cover linked/unlinked users, unknown community, no active match, private vs group context, and no-public-fallback privacy.

### Step 8: Verify, ship, and deploy main

Run all gates, review the diff for unrelated files and secret leakage, commit only scoped files, push, open a PR, and merge after checks. Confirm `origin/main` contains the merge commit and inspect the repository's deployment target/status. If deployment is external and no CLI/workflow/status endpoint exists, report the exact missing integration instead of claiming deployment.

## Test plan

- `src/lib/telegram-rich.test.ts`: block builders, escaping/data handling, limits, tables, long rules, CTA, personal cards.
- `src/lib/telegram-publications.test.ts`: deterministic hash, edit/skip/recreate decision, audience selectors.
- Route/service tests where practical for webhook privacy and fallback selection; keep network and database calls injected/mocked through pure decision functions.
- Use existing `src/lib/tournament-public-view.test.ts` and `src/lib/tournament-applications.test.ts` as test style examples.

## Done criteria

- [ ] Rich tournament messages use typed structured blocks and fall back safely to legacy HTML.
- [ ] Admin can choose tournament template and audience and preview the result responsively.
- [ ] Tournament destinations can be configured without storing bot secrets in the database.
- [ ] Match/deadline notifications are structured and actionable.
- [ ] Live bulletin edits are idempotent and persisted.
- [ ] Results and completion posts support approved/generated media; raw evidence is not auto-published.
- [ ] Community commands use receiver-scoped replies and never leak private data publicly.
- [ ] Prisma validation/generation, focused tests, full tests, typecheck, and build pass.
- [ ] No unrelated dirty files are committed.
- [ ] PR is merged to `main` and deployment status is verified honestly.
- [ ] `plans/README.md` is marked DONE with execution notes in this file.

## STOP conditions

- Official Bot API payloads available in the target environment materially differ from the documented 10.2 rich-message API.
- The configured database cannot accept a Prisma migration without a destructive change.
- Existing unrelated dirty changes overlap an in-scope file and cannot be preserved separately.
- A verification gate fails twice after reasonable fixes.
- GitHub authentication or branch protection prevents opening/merging the PR; report rather than bypassing protection.

## Maintenance notes

- Keep legacy delivery until the minimum supported Telegram client/API behavior is established in production telemetry.
- Telegram tables should remain summaries; link to the website for full standings and schedules.
- Rate-limit/coalesce bulletin edits because one confirmed result can trigger standings, bracket, and notification updates together.
- Review all private group replies for fail-closed behavior whenever Telegram webhook handling changes.
