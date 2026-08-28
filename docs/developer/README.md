# Pongifi • Developer Documentation

Everything needed to work on Pongifi. Start with [getting started](getting-started.md) if you are setting the project
up for the first time.

| Document                                  | What it covers                                                       |
| ----------------------------------------- | -------------------------------------------------------------------- |
| **[Getting started](getting-started.md)** | Prerequisites, install, environment variables, the local command set |
| **[Architecture](architecture.md)**       | The three ideas the design rests on, directory layout, data model    |
| **[Workflow](workflow.md)**               | Branches, environments, deployment, releases                         |

## Conventions

**[`@jens-johnson/style-guide`](https://github.com/jens-johnson/jens-johnson/blob/main/docs/style-guide/README.md) is
the canonical source for every general convention** — formatting, naming, comments and JSDoc, TypeScript, modules and
barrels, testing, git workflow, prose. The root configs in this repo are thin re-exports of that package. Change a
convention upstream; never locally.

Read the hub cheat sheet before writing code, then the spoke for whatever you are touching. The package is private
and git-tag pinned, so the machine needs git access to `github.com/jens-johnson/jens-johnson`.

The handful worth repeating here, because they are the ones most often missed:

- Interfaces are prefixed `I`, type aliases `T`. **Enums take no prefix** — `GameType`, not `EGameType`.
- Members of interfaces, type literals, and enums are **sorted lexicographically**, one blank line apart.
- **Annotate everything**, including local `const` declarations inside functions.
- Comments inside function bodies use `//`. Members of key/value shapes use `/* */`, upgraded to JSDoc when they
  carry a tag such as `@see {@link https://example.com}`.
- Prefer `.map()` / `.forEach()` / `.reduce()` over `for` and `for...of`.
- Every source file opens with a generated logo-block header. **Generate it, never hand-write it:**

  ```bash
  pnpm header -f <path> -d "<one-line description>" --write
  ```

- Commits are `type(scope): subject`, lowercase subject, no camelCase or PascalCase words in the subject.

## Agent context

`CLAUDE.md` at the repo root carries the operational context for coding agents. It points here for anything a human
would also want to know, and holds only what is specific to working the repo with an agent.
