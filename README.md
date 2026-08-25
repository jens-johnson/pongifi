# 🏓 Pongifi

The social ping pong competition app. Create leagues, register games, and track your statistics.

Pongifi is a ping pong league tracker for an office or friend group: create a league, invite players, record games,
and dig into the leaderboards. Three game types are first-class — **singles** (1v1), **doubles** (2v2), and
**cutthroat** (1v1v1, house rules).

## Stack

| Layer             | Choice                                           |
| ----------------- | ------------------------------------------------ |
| Framework         | Nuxt 4 + TypeScript (Vue 3 client, Nitro server) |
| Hosting           | Vercel                                           |
| Database          | Neon serverless Postgres, Drizzle ORM            |
| Cache / ephemeral | Upstash Redis                                    |
| Auth              | Google OIDC                                      |
| Styling           | Tailwind CSS v4, no component library            |
| Realtime          | Server-sent events                               |

## Getting started

Requires Node 24 (see `.nvmrc`) and pnpm 10 via Corepack. [direnv](https://direnv.net/) is optional but recommended.

```bash
corepack enable
pnpm install
cp .env.example .env      # or: vercel env pull .env.local
pnpm dev
```

`pnpm check` runs the full gate — lint, typecheck, test, build.

## Documentation

- **Spec:** [Pongifi: MVP Pitch Document](https://app.notion.com/p/Pongifi-MVP-Pitch-Document-3c7a683b42b780239fd1eb463b76dbf7)
- **Repo conventions and architecture:** [`CLAUDE.md`](./CLAUDE.md)
- **General conventions:** [`@jens-johnson/style-guide`](https://github.com/jens-johnson/jens-johnson/blob/main/docs/style-guide/README.md)

## Environments

| Branch    | Environment | Host                  |
| --------- | ----------- | --------------------- |
| `main`    | Production  | `pongifi.com`         |
| `staging` | Staging     | `staging.pongifi.com` |
| `feat/*`  | Preview     | per-PR preview URL    |

Feature branches open pull requests against `staging`; `staging` is promoted to `main` by an automated pull request.
