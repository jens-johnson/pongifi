# Getting Started

## Prerequisites

- **Node 24**, pinned in `.nvmrc`
- **pnpm 10.10.0**, via Corepack — `corepack enable`
- **[direnv](https://direnv.net/)**, optional but recommended; `direnv allow` once after cloning activates the
  environment
- The **Vercel CLI**, for pulling environment variables

There is no npm or npx in this repo. `bin/wrappers/` rejects both and re-validates the Node version before anything
consequential runs.

## Install

```bash
corepack enable
pnpm install
```

`pnpm install` runs `nuxt prepare` and installs the lefthook git hooks.

## Environment

Secrets live in Vercel and never enter the repository, which is public. There is no checked-in example file; pull the
real values instead:

```bash
vercel link
vercel env pull .env
```

Nuxt reads `.env` on `pnpm dev`. `env.d.ts` at the repo root is the canonical list of what the application reads:

| Variable                                                          | What it is                                       |
| ----------------------------------------------------------------- | ------------------------------------------------ |
| `DATABASE_URL`                                                    | Neon Postgres, **pooled** — used at runtime      |
| `DATABASE_URL_UNPOOLED`                                           | Neon Postgres, **direct** — used by drizzle-kit  |
| `UPSTASH_REDIS_REST_KV_REST_API_URL` / `..._TOKEN`                | Upstash Redis over REST                          |
| `NUXT_OAUTH_GOOGLE_CLIENT_ID` / `..._SECRET` / `..._REDIRECT_URL` | Google OIDC                                      |
| `NUXT_SESSION_PASSWORD`                                           | Seals the session cookie; at least 32 characters |
| `NUXT_PUBLIC_SITE_URL`                                            | Canonical origin for the environment             |

Use the **pooled** connection at runtime. Vercel functions are short-lived, so a long-lived pool would strand
connections. Migrations use the **unpooled** one, because PgBouncer does not support every DDL statement drizzle-kit
issues.

The Upstash variables read oddly because the Vercel Marketplace integration names them after the legacy Vercel KV
variables and then applies the prefix chosen at install time. `nuxt.config.ts` maps them onto `runtimeConfig`, so the
naming stops there and never reaches application code.

## Commands

| Command                | What it does                                                            |
| ---------------------- | ----------------------------------------------------------------------- |
| `pnpm dev`             | Dev server                                                              |
| `pnpm check`           | **The gate**: lint → typecheck → test → build. Green before shipping    |
| `pnpm lint` / `:fix`   | ESLint, Prettier, and Stylelint                                         |
| `pnpm typecheck`       | Nuxt's projects, then `tsconfig.tooling.json` for the root config files |
| `pnpm test` / `:watch` | Vitest                                                                  |
| `pnpm test:coverage`   | Vitest with coverage                                                    |
| `pnpm header`          | Generate a file header — `-f <path> -d "<description>" --write`         |
| `pnpm db:generate`     | Author a migration from the schema                                      |
| `pnpm db:migrate`      | Apply migrations                                                        |
| `pnpm db:studio`       | Browse the database                                                     |

## Git hooks

lefthook runs lint-staged on commit, commitlint on the commit message, and lint, typecheck, and test on push. Bypass
one hook with `LEFTHOOK_EXCLUDE=<name>`; skip everything with `LEFTHOOK=0`. Use both sparingly — the push hook is the
same gate CI runs.

## Working against the database

Local development points at a dedicated Neon branch, never at production. Create one in the Neon console, then set
`DATABASE_URL` and `DATABASE_URL_UNPOOLED` to its pooled and direct connection strings.

Schema lives in `server/db/schema/`, and SQL migrations are generated into `server/db/migrations/` and checked in.
Author one with `pnpm db:generate` and apply it with `pnpm db:migrate`.
