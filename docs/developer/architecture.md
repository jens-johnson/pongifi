# Architecture

Nuxt 4 with TypeScript — Vue 3 on the client, Nitro server routes for the API — deployed on Vercel, with Neon
serverless Postgres and Upstash Redis. Tailwind CSS v4, and deliberately **no component library**: the live recording
surface is a custom table graphic that a component kit would only constrain.

## The three ideas the design rests on

### 1. The rules engine is pure

The rules are implemented **once**, as a pure module under `shared/rules-engine/` with no I/O, consumed by both
client and server. The client drives the recording surface with no round trip; the server replays any submitted log
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

### 2. The event log is the source of truth

A game's score is **never** a mutable counter. It is derived by replaying `GameEvent` rows through the rules engine.
`GameParticipant.finalScore` is a denormalized cache written on completion and always reproducible from the log.

This is what makes undo, amendment, and statistic backfill cheap rather than painful.

### 3. Ratings are append-only snapshots

Rating rows are keyed to the game that caused them; a current rating is the latest snapshot for a given league, user,
and scope. Amending or voiding a game invalidates every snapshot from that game forward and Pongifi replays them in
chronological order.

Ratings are path-dependent, so recomputation has to be deterministic — which is only sound because both the rules
engine and the rating engine are pure functions over the log.

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

## Data and clients

Neon Postgres through `#utils/db` (`useDatabase()`), Upstash Redis through `#utils/cache` (`useCache()`). Both are
lazy per-instance singletons, since Vercel Fluid Compute reuses function instances.

Every secret is read through `runtimeConfig` rather than `process.env` scattered through the code. The exception is
the Google OAuth pair, which `nuxt-auth-utils` reads at request time — mapping those into `runtimeConfig` would bake
build-time values into the output.

Wrap every awaited external call in `runUpstream(promise, 'message.')` from `#utils/http`, which turns unexpected
rejections into 502s while letting deliberate `createError`s pass through.

## Data model

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

## Typechecking

Nuxt generates four projects — app, server, shared, and node. None of them covers the root config files, so
`tsconfig.tooling.json` picks up `drizzle.config.ts`, `vitest.config.ts`, and `env.d.ts`. `pnpm typecheck` runs both.
