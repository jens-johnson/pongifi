# Pongifi

The social ping pong competition app: create leagues, record games, track statistics. Nuxt 4 on Vercel, Neon
Postgres, Upstash Redis.

**Human-facing documentation lives in [`docs/developer`](docs/developer)** — [getting
started](docs/developer/getting-started.md), [architecture](docs/developer/architecture.md), and
[workflow](docs/developer/workflow.md). Read those first; this file holds only what is specific to working the repo
with an agent, and does not repeat them.

**Spec:** [Pongifi: MVP Pitch Document](https://app.notion.com/p/Pongifi-MVP-Pitch-Document-3c7a683b42b780239fd1eb463b76dbf7)
— the source of truth for product decisions, and access-controlled. Section numbering is roman numerals
(`III.II.IX.IV` = Rules → Rule List → Cutthroat → Rotation). Rule references throughout the codebase point at it.

## Before writing code

**Read the style guide.** `@jens-johnson/style-guide` is the canonical source for every general convention, and the
root configs are thin re-exports of it. Read the [hub cheat
sheet](https://github.com/jens-johnson/jens-johnson/blob/main/docs/style-guide/README.md), then the spoke for
whatever you are touching — `typescript.md`, `naming.md`, `comments.md`, `control-flow-and-iteration.md`,
`formatting.md`, `modules-and-imports.md`.

This matters more than it sounds. Seven conventions were missed on this repo's first three pull requests by
inferring them instead of reading: enums take no prefix, `@see` takes a link tag, comments inside function bodies use
`//`, array methods beat `for` loops, constants live in `constants.ts`, annotations are maximal, members sit one
blank line apart. Every one was already written down. **Do not extrapolate a convention by analogy with a
neighbouring one** — the `I` and `T` prefixes are real, and the `E` prefix invented from them was not.

Almost none of this is machine-enforced, so nothing catches a wrong guess except review.

Change conventions upstream in the style guide, never locally.

## Non-negotiables

- **Generate file headers, never hand-write them:** `pnpm header -f <path> -d "<one-line description>" --write`. API
  handlers use the generator's `api` kind and document the full contract — usage, auth, params, query, body, returns,
  throws, side effects.
- **Tests live in-band**: `<file>.test.ts` beside the file it exercises, importing the sibling rather than the
  barrel. `test/` is reserved for end-to-end.
- **`pnpm check` must be green before shipping.** It is the same gate CI runs.
- **Secrets never enter the repo**, which is public. `env.d.ts` is the list of what the application reads.

## Decisions made on top of the spec

Recorded here because they are not in the spec and will otherwise be re-litigated:

- **Time-dependent rules are events, not clock reads.** The cutthroat time cap (III.II.IX.IX) and expedite's trigger
  (III.II.VIII.V) are appended to the log explicitly, so replay stays deterministic.
- **Initial conditions are event zero.** `MATCH_INIT` captures the lot outcome, first server, first receiver, end
  assignment, and the cutthroat rotation.
- **The engine consumes a whole match**, not a single game — III.II.VII.VI and III.II.V.IV need prior-game context.
- **The rules engine lives in-repo** under `shared/`, not as a published package.
- **The margin multiplier is floored at 1.0.** As specified, a retirement recorded at level scores yields a
  multiplier of zero and moves nobody's rating, contradicting VIII.VII.
- **A player's K-factor stays their own** rather than being shared across the two sides, so provisional ratings still
  move at provisional speed. The margin multiplier is shared instead.
- **The mid-game change of ends applies only when `matchFormat > 1`.** Applied to a best-of-one — Pongifi's default —
  it would swap ends mid-game in a casual match.

## Open questions

Tracked in spec XIII.II. The ones that touch code soonest: the brand palette and Google Fonts pairing (the `@theme`
block in `app/assets/css/main.css` is a deliberate placeholder), whether `pongifi.com` serves a logged-out landing
page or redirects to sign-in, and PWA versus plain responsive web app.
