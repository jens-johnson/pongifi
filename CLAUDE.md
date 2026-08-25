# Pongifi

The social ping pong competition app: create leagues, record games, track statistics. Nuxt 4 on Vercel, Neon
Postgres, Upstash Redis.

**Spec:** [Pongifi: MVP Pitch Document](https://app.notion.com/p/Pongifi-MVP-Pitch-Document-3c7a683b42b780239fd1eb463b76dbf7)
— the source of truth. Section numbering is roman numerals (`III.II.IX.IV` = Rules → Rule List → Cutthroat →
Rotation). This file covers only what is specific to the repo.

## Conventions

**`@jens-johnson/style-guide` is the canonical source for all general conventions** — formatting, naming, comments
and JSDoc, TypeScript, modules and barrels, testing, git workflow, prose. The root configs are thin re-exports of
that package; change conventions upstream, never locally. Read the hub cheat sheet before generating code, and load
the spoke for whatever domain you touch:
<https://github.com/jens-johnson/jens-johnson/blob/main/docs/style-guide/README.md>

The package is private and git-tag pinned (currently `v0.9.2`); the machine needs git access to
`github.com/jens-johnson/jens-johnson`.

### The bits worth repeating

- Interfaces are prefixed `I`, type aliases `T`. Exempt: Vue `interface Props` and interfaces augmenting an external
  module.
- Every source file opens with the logo-block header. **Generate it, do not hand-write it:**
  `pnpm header -f <path> -d "<one-line description>" --write`. API handlers use the generator's `api` kind and
  document the full contract (USAGE, AUTH, PARAMS, QUERY, BODY, RETURNS, THROWS, SIDE EFFECTS).
- Tests live in-band: `<file>.test.ts` beside the file it exercises, importing from the sibling file rather than the
  barrel. `test/` is reserved for E2E.
- Commits are `type(scope): subject`, lowercase subject, no camelCase or PascalCase words in the subject.

## Architecture

### Directory layout

```
app/components/<category>/<name>/   atomic design; category is one of brand, containment, data, feedback,
                                    layout, primitives, widgets. Each component is index.vue in its own
                                    folder with co-located types.ts / enums.ts / constants.ts / utils.ts
app/composables/use-<name>/         index, composable, types
app/utils/<group>/<name>/           index, utils, types
app/types/<domain>/                 index, enums, types      -> import via `~/types/<domain>`
server/utils/<name>/                index, utils/client, types -> import via `#utils/<name>`
server/api, server/routes           flat filenames; Nitro routing depends on it
server/db/schema, server/db/migrations   Drizzle schema and checked-in SQL migrations
shared/<name>/                      isomorphic -> import via `#shared/<name>`
```

Everything exported under `composables/`, `utils/`, and `server/utils/` is auto-imported globally, so keep internal
helpers unexported. `nuxt.config.ts` scans those trees recursively (`imports.dirs`) because barrel `index.ts` files
use `export *`, which unimport ignores.

### The three ideas that carry the design

1. **The rules engine is pure.** The rules in spec III are implemented once as a pure TypeScript module with no I/O,
   consumed by both client and server. The client drives the recording UI with no round trip; the server replays any
   submitted log through the same code, so a buggy or tampered client cannot write an impossible game. The rule list
   in spec III.II is the test corpus.
2. **The event log is the source of truth.** A game's score is never a mutable counter — it is derived by replaying
   `GameEvent` rows. `GameParticipant.finalScore` is a denormalized cache written on completion and always
   reproducible from the log. This is what makes undo, amendment, and stat backfill cheap.
3. **Ratings are append-only snapshots** keyed to the game that caused them. Current rating = the latest snapshot for
   a (league, user, scope). Amending or voiding a game invalidates every snapshot from that game forward and Pongifi
   replays them in order. Ratings are path-dependent, so recomputation must be deterministic.

### Decisions made on top of the spec

- **Time-dependent rules are events, not clock reads.** The cutthroat time cap (III.II.IX.IX) and expedite's
  10-minute trigger (III.II.VIII.V) are appended to the log as explicit events rather than passed in as `now`, so
  replay stays deterministic forever.
- **Initial conditions are event zero.** A `MATCH_INIT` event captures the lot outcome, first server, first receiver,
  end assignment, and the cutthroat rotation, so the log is self-sufficient.
- **The engine consumes a whole match**, not a single game. III.II.VII.VI (previous game's receiver serves next) and
  III.II.V.IV (doubles receiving order reverses in the deciding game) need prior-game context.
- **The rules engine lives in-repo** under `shared/`, not as a published package. Same purity, no publish overhead.

## Data and secrets

- Neon Postgres via `#utils/db` (`useDatabase()`), Upstash Redis via `#utils/cache` (`useCache()`). Both are lazy
  per-instance singletons; Vercel Fluid Compute reuses instances.
- Use the **pooled** Neon connection string. Vercel functions are short-lived, so a long-lived pool strands
  connections.
- Read every secret through `runtimeConfig` (server-only keys), never `process.env` scattered through the code. The
  exception is the Google OAuth pair, which `nuxt-auth-utils` reads at request time — mapping those into
  `runtimeConfig` would bake build-time values into the output.
- Wrap every awaited external call (DB, Redis, third-party APIs) in `runUpstream(promise, 'message.')` from
  `#utils/http`, which turns unexpected rejections into 502s while letting deliberate `createError`s pass through.
- **The repo is public. Secrets never enter it.** `.env.example` holds placeholders; real values live in Vercel.

## Environments and git flow

| Branch    | Environment | Host                  | Database                       |
| --------- | ----------- | --------------------- | ------------------------------ |
| `main`    | Production  | `pongifi.com`         | primary Neon database          |
| `staging` | Staging     | `staging.pongifi.com` | long-lived Neon branch, seeded |
| `feat/*`  | Preview     | per-PR preview URL    | Neon branch cut from staging   |

Flow: `feat/*` → PR into **`staging`** (UAT) → auto-PR into **`main`** (prod). **Merge the staging→main promotion PR
with a merge commit, never squash** — squashing duplicates Release-Please changelog entries. After merging to `main`,
sync `staging` back with `git merge main`.

## Local commands

```bash
corepack enable && pnpm install   # first run; installs lefthook hooks via `prepare`
pnpm dev                          # dev server
pnpm check                        # lint -> typecheck -> test -> build; must be green before shipping
pnpm lint:fix                     # autofix eslint + prettier + stylelint
pnpm header -f <path> -d "<desc>" --write
pnpm db:generate / db:migrate / db:studio
```

Node 24 (pinned in `.nvmrc`), pnpm 10.10.0 via Corepack. **No npm or npx** — `bin/wrappers/` rejects them and
re-validates the Node version. `direnv allow` once after cloning activates the environment.

lefthook runs lint-staged on commit, commitlint on commit-msg, and lint + typecheck + test on push. Bypass one hook
with `LEFTHOOK_EXCLUDE=<name>`; skip all with `LEFTHOOK=0`.

## Open questions

Tracked in spec XIII.II. The ones that touch the code soonest: the brand palette and Google Fonts pairing (the
`@theme` block in `app/assets/css/main.css` is a deliberate placeholder), whether `pongifi.com` serves a logged-out
landing page or redirects to sign-in, and PWA versus plain responsive web app.
