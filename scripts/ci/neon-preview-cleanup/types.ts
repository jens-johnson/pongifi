/**
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 *
 *                                  ██████╗  ██████╗ ███╗   ██╗ ██████╗ ██╗███████╗██╗
 *                                  ██╔══██╗██╔═══██╗████╗  ██║██╔════╝ ██║██╔════╝██║
 *                                  ██████╔╝██║   ██║██╔██╗ ██║██║  ███╗██║█████╗  ██║
 *                                  ██╔═══╝ ██║   ██║██║╚██╗██║██║   ██║██║██╔══╝  ██║
 *                                  ██║     ╚██████╔╝██║ ╚████║╚██████╔╝██║██║     ██║
 *                                  ╚═╝      ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝ ╚═╝╚═╝     ╚═╝
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 * █████████████████████████████████████ scripts/ci/neon-preview-cleanup/types.ts ██████████████████████████████████████
 *
 * Contracts for guarded Neon preview database cleanup.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * A Neon branch record containing every field needed for deletion safety checks.
 * @public
 * @interface
 */
export interface INeonBranch {
  /* Whether this is the project's default branch */
  default: boolean;

  /* The provider-assigned branch identifier */
  id: string;

  /* The human-readable branch name */
  name: string;

  /* Whether this is the project's primary branch */
  primary: boolean;

  /* Whether Neon protects this branch from mutations */
  protected: boolean;
}

/**
 * The injected configuration and I/O boundaries for one cleanup attempt.
 * @public
 * @interface
 */
export interface INeonPreviewCleanupOptions {
  /* The repository's Neon API credential */
  apiKey: string | undefined;

  /* The provider project id established from the Vercel integration */
  expectedProjectId: string;

  /* The HTTP client used for Neon API requests */
  fetchImpl: typeof fetch;

  /* The GitHub reader for other open pull requests sharing the head */
  fetchOpenPullRequests: TFetchOpenPullRequests;

  /* The GitHub reader for the triggering pull request's current state */
  fetchPullRequest: TFetchPullRequest;

  /* The owner-selected repository variable naming the Neon project */
  projectId: string | undefined;

  /* The expected same-repository pull request origin */
  repository: string;
}

/**
 * The visible result of one cleanup attempt.
 * @public
 * @interface
 */
export interface INeonPreviewCleanupResult {
  /* Whether this attempt deleted a branch */
  deleted: boolean;

  /* The explicit cleanup, no-op, or skip explanation */
  message: string;
}

/**
 * The validated GitHub pull request state used by cleanup guards.
 * @public
 * @interface
 */
export interface IPullRequest {
  /* The target branch state */
  base: {
    /* The target Git branch */
    ref: string;
  };

  /* The source branch state */
  head: {
    /* The source Git branch */
    ref: string;

    /* The source repository identity */
    repo: {
      /* The owner-qualified repository name */
      full_name: string;

      /* The source repository owner */
      owner: {
        /* The GitHub owner login */
        login: string;
      };
    };
  };

  /* The repository-local pull request number */
  number: number;

  /* The current GitHub pull request state */
  state: string;
}

/**
 * Reads all currently open pull requests for one same-owner Git head.
 * @public
 * @typedef
 */
export type TFetchOpenPullRequests = (headOwner: string, headReference: string) => Promise<unknown>;

/**
 * Re-reads the triggering pull request from GitHub.
 * @public
 * @typedef
 */
export type TFetchPullRequest = () => Promise<unknown>;
