<div align="center">

```
██████╗  ██████╗ ███╗   ██╗ ██████╗ ██╗███████╗██╗
██╔══██╗██╔═══██╗████╗  ██║██╔════╝ ██║██╔════╝██║
██████╔╝██║   ██║██╔██╗ ██║██║  ███╗██║█████╗  ██║
██╔═══╝ ██║   ██║██║╚██╗██║██║   ██║██║██╔══╝  ██║
██║     ╚██████╔╝██║ ╚████║╚██████╔╝██║██║     ██║
╚═╝      ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝ ╚═╝╚═╝     ╚═╝
```

# Pongifi

**The social ping pong competition app — [pongifi.com](https://pongifi.com)**

[![Nuxt](https://img.shields.io/badge/Nuxt-00DC82?style=for-the-badge&logo=nuxtdotjs&logoColor=white)](https://nuxt.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Postgres](https://img.shields.io/badge/Neon_Postgres-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://neon.com/)
[![Redis](https://img.shields.io/badge/Upstash_Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://upstash.com/)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)

</div>

## What it is

Pongifi turns the ping pong table your office already argues over into a league worth keeping records for. Create a
league, invite the people you play against, record games as they happen, and watch the leaderboard sort out who is
actually any good.

It came out of a real need: a group of coworkers playing daily, keeping score on a whiteboard, and losing the whole
season every time somebody wiped it.

## Game types

All three are first-class — the rules, the recording surface, and the ratings each understand them natively.

| Type          | Players | Notes                                                                           |
| ------------- | ------- | ------------------------------------------------------------------------------- |
| **Singles**   | 1v1     | Standard ITTF rules                                                             |
| **Doubles**   | 2v2     | Standard ITTF rules, including service and receiving rotation                   |
| **Cutthroat** | 1v1v1   | House rules: one player serves alone against two, and only the server can score |

## What makes it different

**Recording is the product.** One person records for the group from a top-down view of the table — tap a player to
award the point, and service changes, end changes, and the cutthroat rotation animate so you watch the state change
instead of tracking it in your head. Nobody else has to open the app while you play.

**Nothing is a mutable counter.** A game's score is derived by replaying its event log, which is what makes undo,
amendment, and after-the-fact corrections cheap instead of dangerous. Ratings are append-only snapshots keyed to the
game that caused them, so correcting a result three weeks later recomputes cleanly rather than silently drifting.

**The rules are real rules.** Win-by-two, service intervals, deuce, change of ends, the expedite system, the
cutthroat time cap — implemented once as a pure module the app and the server both run, so the client can drive the
recording surface with no round trip while the server independently verifies every game it is asked to store.

## Status

In active development, pre-launch. The rules engine, rating engine, and data model are in place; authentication,
league management, and the recording surface are being built on top of them.

## Documentation

- **[Developer documentation](docs/developer)** — getting started, architecture, and the deployment workflow
- **[Contributing conventions](https://github.com/jens-johnson/jens-johnson/blob/main/docs/style-guide/README.md)** —
  the shared style guide this project is written against

## License

Not yet licensed. All rights reserved.
