# Pongifi • Architecture

Pongifi is a Nuxt 4 application built with TypeScript, including Vue 3 on the client and Nitro server routes for the
API. This project is deployed on Vercel, with Neon serverless Postgres and Upstash Redis. Tailwind CSS v4, and
deliberately **no component library**: the live recording surface is a custom table graphic that a component kit would
only constrain.

## Core Design Principles

### 1. The Rules Engine is Pure

The rules are implemented **once**, as a pure module under `shared/rules-engine/` with no I/O, consumed by both
client and server. The client drives the recording surface with no round trip while the server replays any submitted log
through the same code, so a buggy or tampered client cannot write an impossible game.

```text
replayMatch(settingsSnapshot, orderedEvents) -> {
  scores, server, receiver, rotationPosition, ends,
  gameNumber, gamesWon, isComplete, status, winner,
  isDeuce, isExpedite, legalNextEvents
}
```

Four decisions shape it:

- **It consumes a whole match, not a single game.** The rule that the previous game's receiver serves first, and the
  one that reverses doubles receiving order in a deciding game, both need prior-game context.
- **Time-dependent rules arrive as events, not clock reads.** The cutthroat time cap and expedite's trigger are
  appended as explicit events, so a replay is deterministic forever.
- **Initial conditions are event zero.** A `MATCH_INIT` event carries the lot outcome, the rotation, and the starting
  ends, so the log is self-sufficient.
- **`ends` is null for cutthroat**, where the rotation already moves every player through both ends.

A rally is recorded as `{ wonBy: SERVING | RECEIVING }` rather than naming a winner — the only phrasing that works in
all three game types, since cutthroat's free-for-all returns have no unambiguous winner on the pair side.

### 2. The Event Log is the Source of Truth

A game's score is **never** a mutable counter. It is derived by replaying `GameEvent` rows through the rules engine.
`GameParticipant.finalScore` is a denormalized cache written on completion and always reproducible from the log.

This is what makes undo, amendment, and statistic backfill cheap rather than painful.

### 3. Ratings Are Append-Only Snapshots, Addressed By Generation

Rating rows are keyed to the game that caused them and to the **generation** that computed them. A generation is one
complete recomputation of a league's ladder; the league points at exactly one of them through
`active_rating_generations`, and every rating read follows that pointer and the replay's chronological order. A
current rating is _never_ the newest snapshot by insertion time: that is what a half-published rebuild looks like
from the outside.

Anything that changes what a league rates — a result settling, a correction, a void — recomputes the whole eligible
stream from the opening rating with no games behind it, and publishes the generation, its snapshots and the pointer
in one transaction. The whole stream, rather than the players involved, because ratings are transitive: changing
A against B changes B, which changes what beating B was worth to C, which changes C against D. Superseded
generations stay as audit history.

Ratings are path-dependent, so recomputation has to be deterministic, which is only sound because both the rules
engine and the rating engine are pure functions over the log.

A recomputation is bounded by four limits, not three. `statement_timeout`, `lock_timeout` and
`idle_in_transaction_session_timeout` each bound one wait inside the database; a whole-operation budget in
`withInteractiveTransaction` bounds the sequence, because a replay is hundreds of short statements and no
database-side limit measures their total.

## Directory layout

```text
app/components/<category>/<name>/   atomic design; category is one of brand, containment, data, feedback,
                                    layout, primitives, widgets. Each component is index.vue in its own
                                    folder with co-located types.ts / enums.ts / constants.ts / utils.ts
app/composables/use-<name>/         index, composable, types
app/utils/<group>/<name>/           index, utils, types
app/types/<domain>/                 index, enums, types        -> import via `~/types/<domain>`
server/utils/<name>/                index, utils/client, types -> import via `#utils/<name>`
server/api, server/routes           flat filenames; Nitro routing depends on it
server/db/schema, server/db/migrations   Drizzle schema and checked-in SQL migrations
shared/<name>/                      isomorphic                 -> import via `#shared/<name>`
```

Everything exported under `composables/`, `utils/`, and `server/utils/` is auto-imported globally, so internal
helpers stay unexported. `nuxt.config.ts` scans those trees recursively, because barrel `index.ts` files use
`export *`, which unimport ignores.

`package.json` also declares `"imports": { "#shared/*": "./shared/*/index.ts" }`. Nuxt provides `#shared` at build
time, but drizzle-kit resolves the schema outside Nuxt entirely, so the alias has to exist as a standard Node subpath
import too.

## Data and Clients

Neon Postgres through `#utils/db` (`useDatabase()`), Upstash Redis through `#utils/cache` (`useCache()`). Both are
lazy per-instance singletons, since Vercel Fluid Compute reuses function instances.

Every secret is read through `runtimeConfig` rather than `process.env` scattered through the code. The exception is
the Google OAuth pair, which `nuxt-auth-utils` reads at request time — mapping those into `runtimeConfig` would bake
build-time values into the output.

Wrap every awaited external call in `runUpstream(promise, 'message.')` from `#utils/http`, which turns unexpected
rejections into 502s while letting deliberate `createError`s pass through.

## Data Model

Eleven tables model accounts, leagues, games, and ratings. The decisions worth knowing:

- **`game_events.detail` is jsonb**, typed in application code as the rules engine's own event union and validated at
  the API boundary, so the looseness of the column never reaches domain logic. `detail_version` records which
  revision of the taxonomy a row was written under.
- **Best-of-N uses `match_id` and `game_number` on `games`** — no parent table. A standalone game has a null
  `match_id`, and match aggregates are a group-by rather than a join.
- **Guests are a nullable `user_id` plus a `guest_name`** on a participant row, enforced by a check constraint. A
  guest is a per-game label rather than an identity; two games with a guest called "Dave" are not the same Dave.
- **`user_accounts` holds provider identities** rather than a column on the user, so a Google subject has somewhere
  to live and adding a second provider later is a row rather than a backfill.
- **A result is a journal of revisions, not a mutable row.** `result_revisions` holds every revision of a recorded
  result, with exactly one current per match enforced by a partial unique index, and names the game rows it includes
  through `result_revision_games`. A correction writes new game rows and stamps the old ones `superseded_at`; the old
  rows stay readable and addressable, so **every count, list and ladder predicate must filter `superseded_at IS
NULL`** or it will count a score nobody stands behind twice. A commissioner's void is a different thing entirely and
  never sets that stamp: it moves the game rows to `VOID`, which every eligibility predicate already excludes.
- **A match is addressed by revision one's first game id** (`result_revisions.canonical_match_id`), for the whole of
  its life. That is the page's URL; game two of a best-of-three, and every game row a superseded revision left
  behind, resolve to it after the same membership check the page itself makes. The service mints the game ids so the
  revision row can name one before those rows exist.
- **Every result write carries a receipt.** `result_operations` is unique over the actor, the operation and the
  client's own operation id, so a request whose answer was lost is resolved by replaying the identical action rather
  than by writing a second one; a changed body under the same key conflicts.
- **Dispute notes live apart from the scoring evidence** in `result_dispute_notes`, so deletion can redact the words
  without touching the scores, the ratings or the receipts. Deletion and note-writing share an account-row locking
  protocol: the redactor takes the account `FOR UPDATE`, and a note writer takes every account the match names
  `FOR SHARE` as its last lock and re-reads `deleted_at` under it. A note about a match with an already-deleted
  participant is stored born-redacted — the row and its stamp, never the words — so the two orders are equivalent.

## Typechecking

Nuxt generates four projects — app, server, shared, and node. None of them covers the root config files, so
`tsconfig.tooling.json` picks up `drizzle.config.ts`, `vitest.config.ts`, `env.d.ts`, and everything under
`scripts/`. It carries the `#shared` and `#utils` aliases so a script can exercise application code, which is why
the interactive transaction transport takes its connection string as a parameter and
`useResultTransaction` — the Nuxt-aware wrapper — is what supplies the deployed one. `pnpm typecheck` runs both.
