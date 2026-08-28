# Workflow

## Environments

Three long-lived branches, three environments.

| Branch    | Environment | Host                  | Database                                  |
| --------- | ----------- | --------------------- | ----------------------------------------- |
| `main`    | Production  | `pongifi.com`         | Primary Neon database                     |
| `staging` | Staging     | `staging.pongifi.com` | Long-lived Neon branch, seeded            |
| `preview` | Preview     | `preview.pongifi.com` | Neon branch tracking the `preview` branch |
| `feat/*`  | Per-PR      | Vercel preview URL    | Neon branch per git branch                |

The Neon integration names a database branch after the **git** branch, so each one has a single database that
persists across deployments rather than a fresh one per deploy.

`preview.pongifi.com` exists because Google OAuth rejects wildcards in redirect URIs. Per-deployment preview URLs are
random and cannot be registered, so previews point their callback at that one fixed host.

## Branching

```text
feat/*  ──PR──▶  staging  ──auto-PR──▶  main
```

1. Branch from `staging` as `feat/<name>`, or `fix/<name>` / `refactor/<name>` / `docs/<name>` as appropriate.
2. Open a pull request against **`staging`**. CI runs lint, typecheck, test, and build.
3. Merging to `staging` deploys to `staging.pongifi.com` and opens a promotion pull request into `main`
   automatically.
4. **Merge the promotion pull request with a merge commit, never a squash.** Squashing duplicates Release Please
   changelog entries.
5. After merging to `main`, sync `staging` back with `git merge main`.

`main` is protected: status checks required and strict, conversation resolution required, no force pushes, no
deletions, and administrators included. `staging` is protected against deletion and non-fast-forward pushes.

## Commits

Conventional Commits, enforced by commitlint on the commit-msg hook:

```text
type(scope): subject
```

Lowercase subject, no camelCase or PascalCase words — rewrite them into plain English. Types are `feat`, `fix`,
`refactor`, `style`, `docs`, `test`, `chore`, `ci`, and `perf`. The scope enum lives in `commitlint.config.js`.

## Releases

Release Please watches `main`, maintains a release pull request, and generates `CHANGELOG.md` from commit history.
Merging that pull request tags the release and updates the changelog — the file is generated, so never edit it by
hand.

Because the changelog is built from commit subjects, a vague commit message becomes a vague changelog entry.

## Continuous integration

| Workflow            | Trigger                            | What it does                                         |
| ------------------- | ---------------------------------- | ---------------------------------------------------- |
| **CI**              | PRs and pushes to `main`/`staging` | Lint, typecheck, test, then build                    |
| **CodeQL**          | PRs, pushes, schedule              | Static security analysis                             |
| **Promote Staging** | Pushes to `staging`                | Opens or updates the promotion PR into `main`        |
| **Release Please**  | Pushes to `main`                   | Maintains the release PR and changelog               |
| **Node LTS Watch**  | Weekly                             | Opens an issue when the pinned Node version is stale |

Vercel deploys from its GitHub integration rather than from CI, so there is no deploy step in the workflows.
