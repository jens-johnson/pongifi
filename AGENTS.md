# Pongifi Agent Instructions

Pongifi is a social ping pong competition app for creating leagues, recording games, and tracking statistics. It is
built with Nuxt 4, Vercel, Neon Postgres, and Upstash Redis.

Read the human-facing documentation in [`docs/developer`](docs/developer) before editing: [getting
started](docs/developer/getting-started.md), [architecture](docs/developer/architecture.md), and
[workflow](docs/developer/workflow.md). This file contains only repository-specific agent context.

The access-controlled [Pongifi MVP Pitch
Document](https://app.notion.com/p/Pongifi-MVP-Pitch-Document-3c7a683b42b780239fd1eb463b76dbf7) is the source of
truth for product decisions. Section numbering is roman numerals (`III.II.IX.IV` means Rules, Rule List, Cutthroat,
Rotation). Rule references throughout the codebase point to it.

## Before Writing Code

`@jens-johnson/style-guide` is the canonical source for general conventions, and the root configs are thin
re-exports of it. Read its [hub cheat
sheet](node_modules/@jens-johnson/style-guide/docs/style-guide/README.md), [task reading
matrix](node_modules/@jens-johnson/style-guide/docs/style-guide/agent-workflow.md#read-by-task), and every applicable
spoke before planning or editing. Existing project code is precedent, not authority; when it conflicts with the
guide, follow the guide unless this file documents an intentional override.

Do not infer one convention from another. Enums take no prefix, `@see` takes a link tag, function-body comments use
`//`, array methods beat `for` loops, constants live in `constants.ts`, annotations are maximal, and members have a
blank line between them. Change shared conventions upstream in the style guide, never locally.

Record the branch, base commit, existing working-tree changes, and installed guide revision for an audit. Inspect
the effective config on representative files, and manually review requirements the tools cannot enforce. For SFC
work, this includes header contracts, divider presence, atomic folder placement, JSDoc tags, and reactive annotation
form.

## Non-Negotiables

- Generate file headers with `pnpm header`; never hand-write them. Use `--spec` for component and API contracts.
- Keep unit tests in-band as `<file>.test.ts`, importing the sibling rather than its barrel. Reserve `test/` for
  end-to-end tests.
- Run `pnpm check` before shipping. For structural or user-facing work, also exercise the affected routes and
  interactions.
- Keep secrets out of this public repository. `env.d.ts` is the list of values the application reads.
- Preserve unrelated owner and agent changes in the working tree. Commit only the files in the current task.

## Product Decisions

- Time-dependent rules are events, not clock reads. The cutthroat time cap (III.II.IX.IX) and expedite trigger
  (III.II.VIII.V) are appended to the log explicitly so replay stays deterministic.
- Initial conditions are event zero. `MATCH_INIT` captures the lot outcome, first server, first receiver, end
  assignment, and cutthroat rotation.
- The engine consumes a whole match, not a single game. Rules III.II.VII.VI and III.II.V.IV need prior-game context.
- The rules engine lives in this repository under `shared/`, not in a published package.
- The margin multiplier is floored at 1.0. As specified, a retirement recorded at level scores yields a multiplier
  of zero and moves nobody's rating, contradicting VIII.VII.
- A player's K-factor stays their own rather than being shared across both sides, so provisional ratings still move
  at provisional speed. The margin multiplier is shared instead.
- The mid-game change of ends applies only when `matchFormat > 1`. Applying it to a best-of-one, Pongifi's default,
  would swap ends mid-game in a casual match.

## Open Questions

Track open product questions in spec XIII.II. The nearest code concerns are the brand palette and Google Fonts
pairing, whether `pongifi.com` serves a logged-out landing page or redirects to sign-in, and PWA versus a plain
responsive web app. The `@theme` block in `app/assets/css/main.css` remains a deliberate placeholder.
