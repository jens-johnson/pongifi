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
 * ███████████████████████████████████ scripts/ci/neon-preview-cleanup/utils.test.ts ███████████████████████████████████
 *
 * Guard and provider-boundary tests for Neon preview database cleanup.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import type { Mock } from 'vitest';
import { describe, expect, it, vi } from 'vitest';

import { symbolName } from '#shared/utils/symbol';

import type { INeonBranch, INeonPreviewCleanupOptions, IPullRequest } from './types.ts';
import { runNeonPreviewCleanup } from './utils.ts';

/**
 * A Neon branch-list fixture body.
 * @internal
 * @interface
 */
interface IBranchResponse {
  /* The active provider branch fixtures */
  branches: INeonBranch[];
}

/**
 * The configured Pongifi Neon project id.
 * @internal
 * @constant
 */
const EXPECTED_PROJECT_ID: string = 'red-mode-26063499';

/**
 * A same-repository closed pull request into staging.
 * @internal
 * @constant
 */
const CLOSED_PULL_REQUEST: IPullRequest = {
  base: {
    ref: 'staging',
  },
  head: {
    ref: 'feat/ratings',
    repo: {
      full_name: 'jens-johnson/pongifi',
      owner: {
        login: 'jens-johnson',
      },
    },
  },
  number: 27,
  state: 'closed',
};

/**
 * Builds one active disposable Neon branch response.
 * @internal
 * @function
 * @param name - The provider branch name
 * @returns The list-branches response body
 */
function buildBranchResponse(name: string = 'preview/feat/ratings'): IBranchResponse {
  return {
    branches: [
      {
        default: false,
        id: 'br-small-rain-123456',
        name,
        primary: false,
        protected: false,
      },
    ],
  };
}

/**
 * Builds cleanup options with isolated GitHub and Neon fixtures.
 * @internal
 * @function
 * @param overrides - Fixture values to replace
 * @returns The complete cleanup options
 */
function buildOptions(overrides: Partial<INeonPreviewCleanupOptions> = {}): INeonPreviewCleanupOptions {
  const fetchImpl: typeof fetch = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json(buildBranchResponse()))
    .mockResolvedValueOnce(Response.json({}));

  return {
    apiKey: 'test-api-key',
    expectedProjectId: EXPECTED_PROJECT_ID,
    fetchImpl,
    fetchOpenPullRequests: vi.fn().mockResolvedValue([]),
    fetchPullRequest: vi.fn().mockResolvedValue(CLOSED_PULL_REQUEST),
    projectId: EXPECTED_PROJECT_ID,
    repository: 'jens-johnson/pongifi',
    ...overrides,
  };
}

describe(getTestFileName(import.meta.url), (): void => {
  describe(symbolName(runNeonPreviewCleanup), (): void => {
    it('deletes the exact structured provider branch id for an ordinary closure', async (): Promise<void> => {
      // Run the ordinary same-repository cleanup
      const options: INeonPreviewCleanupOptions = buildOptions();
      const result = await runNeonPreviewCleanup(options);

      // Confirm lookup uses the integration name while deletion uses only the provider id
      expect(result).toEqual({
        deleted: true,
        message: 'Deleted Neon branch preview/feat/ratings (br-small-rain-123456) for closed pull request #27',
      });
      expect(options.fetchImpl).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          search: '?include_deleted=false&limit=10000&search=preview%2Ffeat%2Fratings',
        }),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer test-api-key' }),
        }),
      );
      expect(options.fetchImpl).toHaveBeenNthCalledWith(
        2,
        'https://console.neon.tech/api/v2/projects/red-mode-26063499/branches/br-small-rain-123456',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('skips a pull request that was reopened before cleanup', async (): Promise<void> => {
      // Re-read an open pull request
      const options: INeonPreviewCleanupOptions = buildOptions({
        fetchPullRequest: vi.fn().mockResolvedValue({ ...CLOSED_PULL_REQUEST, state: 'open' }),
      });

      // Confirm no provider request runs
      await expect(runNeonPreviewCleanup(options)).resolves.toEqual({
        deleted: false,
        message: 'Skipped Neon preview cleanup: pull request #27 is open, not closed',
      });
      expect(options.fetchImpl).not.toHaveBeenCalled();
    });

    it('skips deletion when a pull request reopens after provider lookup', async (): Promise<void> => {
      // Close the event, then return its current reopened state at the final guard
      const options: INeonPreviewCleanupOptions = buildOptions({
        fetchPullRequest: vi
          .fn()
          .mockResolvedValueOnce(CLOSED_PULL_REQUEST)
          .mockResolvedValueOnce({ ...CLOSED_PULL_REQUEST, state: 'open' }),
      });

      // Confirm the inventory read cannot race into a deletion
      await expect(runNeonPreviewCleanup(options)).resolves.toEqual({
        deleted: false,
        message: 'Skipped Neon preview cleanup: pull request #27 changed after provider lookup',
      });
      expect(options.fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('skips a Git branch still used by another open pull request', async (): Promise<void> => {
      // Return another open pull request for the same repository and head
      const options: INeonPreviewCleanupOptions = buildOptions({
        fetchOpenPullRequests: vi.fn().mockResolvedValue([
          {
            ...CLOSED_PULL_REQUEST,
            number: 28,
            state: 'open',
          },
        ]),
      });

      // Confirm shared-branch data remains intact
      await expect(runNeonPreviewCleanup(options)).resolves.toEqual({
        deleted: false,
        message: 'Skipped Neon preview cleanup: Git branch feat/ratings still belongs to an open pull request',
      });
      expect(options.fetchImpl).not.toHaveBeenCalled();
    });

    it('skips deletion when the final open-list read observes the triggering pull request reopened', async (): Promise<void> => {
      // Keep both individual reads closed, then expose the reopened triggering pull request in the final list read
      const options: INeonPreviewCleanupOptions = buildOptions({
        fetchOpenPullRequests: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ ...CLOSED_PULL_REQUEST, state: 'open' }]),
      });

      // Confirm the freshest open-list evidence prevents the provider mutation
      await expect(runNeonPreviewCleanup(options)).resolves.toEqual({
        deleted: false,
        message: 'Skipped Neon preview cleanup: Git branch feat/ratings gained an open pull request',
      });
      expect(options.fetchPullRequest).toHaveBeenCalledTimes(2);
      expect(options.fetchOpenPullRequests).toHaveBeenCalledTimes(2);
      expect(options.fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('skips long-lived and local-development Git branches', async (): Promise<void> => {
      // Exercise every retained namespace independently
      const protectedReferences: string[] = [
        'main',
        'staging',
        'preview',
        'dev/jens',
        'local/sol',
        'release-please--branches--main--components--pongifi',
      ];

      await Promise.all(
        protectedReferences.map(async (headReference: string): Promise<void> => {
          const options: INeonPreviewCleanupOptions = buildOptions({
            fetchPullRequest: vi.fn().mockResolvedValue({
              ...CLOSED_PULL_REQUEST,
              head: {
                ...CLOSED_PULL_REQUEST.head,
                ref: headReference,
              },
            }),
          });

          await expect(runNeonPreviewCleanup(options)).resolves.toEqual({
            deleted: false,
            message: `Skipped Neon preview cleanup: Git branch ${headReference} is retained by policy`,
          });
          expect(options.fetchImpl).not.toHaveBeenCalled();
        }),
      );
    });

    it('skips fork pull requests before reading secrets or calling Neon', async (): Promise<void> => {
      // Return a fork head and omit provider configuration
      const options: INeonPreviewCleanupOptions = buildOptions({
        apiKey: undefined,
        fetchPullRequest: vi.fn().mockResolvedValue({
          ...CLOSED_PULL_REQUEST,
          head: {
            ...CLOSED_PULL_REQUEST.head,
            repo: {
              ...CLOSED_PULL_REQUEST.head.repo,
              full_name: 'contributor/pongifi',
            },
          },
        }),
        projectId: undefined,
      });

      // Confirm fork events need no secrets
      await expect(runNeonPreviewCleanup(options)).resolves.toEqual({
        deleted: false,
        message: 'Skipped Neon preview cleanup: pull request #27 comes from a fork',
      });
      expect(options.fetchImpl).not.toHaveBeenCalled();
    });

    it('treats an already-absent Neon branch as a successful no-op', async (): Promise<void> => {
      // Return an empty provider inventory
      const fetchImpl: typeof fetch = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ branches: [] }));
      const options: INeonPreviewCleanupOptions = buildOptions({ fetchImpl });

      // Confirm retries report completion without a delete request
      await expect(runNeonPreviewCleanup(options)).resolves.toEqual({
        deleted: false,
        message: 'Neon branch preview/feat/ratings is already absent; cleanup is complete',
      });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('treats a branch removed between lookup and deletion as a successful no-op', async (): Promise<void> => {
      // Return an exact inventory match followed by Neon's already-absent response
      const fetchImpl: typeof fetch = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json(buildBranchResponse()))
        .mockResolvedValueOnce(new Response(null, { status: 204 }));
      const options: INeonPreviewCleanupOptions = buildOptions({ fetchImpl });

      // Confirm a concurrent cleanup remains idempotent and accurately reported
      await expect(runNeonPreviewCleanup(options)).resolves.toEqual({
        deleted: false,
        message: 'Neon branch preview/feat/ratings was already absent when deletion ran; cleanup is complete',
      });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it('refuses provider branches marked default, primary, or protected', async (): Promise<void> => {
      // Exercise every provider-side retention flag independently
      const retentionFlags: ReadonlyArray<'default' | 'primary' | 'protected'> = ['default', 'primary', 'protected'];

      await Promise.all(
        retentionFlags.map(async (retentionFlag: 'default' | 'primary' | 'protected'): Promise<void> => {
          const branchResponse: IBranchResponse = buildBranchResponse();
          const branch: INeonBranch = branchResponse.branches[0]!;
          branch[retentionFlag] = true;
          const options: INeonPreviewCleanupOptions = buildOptions({
            fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(Response.json(branchResponse)),
          });

          await expect(runNeonPreviewCleanup(options)).rejects.toThrow(
            'Neon branch preview/feat/ratings is default, primary, or protected; refusing deletion',
          );
          expect(options.fetchImpl).toHaveBeenCalledTimes(1);
        }),
      );
    });

    it('surfaces missing configuration and provider failures', async (): Promise<void> => {
      // Remove the secret, then return a provider authentication failure
      const missingConfigOptions: INeonPreviewCleanupOptions = buildOptions({ apiKey: undefined });
      const providerFailureOptions: INeonPreviewCleanupOptions = buildOptions({
        fetchImpl: vi
          .fn<typeof fetch>()
          .mockResolvedValue(Response.json({ message: 'authentication failed' }, { status: 401 })),
      });

      // Confirm neither condition can masquerade as successful cleanup
      await expect(runNeonPreviewCleanup(missingConfigOptions)).rejects.toThrow(
        'NEON_API_KEY is not configured; add it in GitHub Actions repository settings',
      );
      await expect(runNeonPreviewCleanup(providerFailureOptions)).rejects.toThrow(
        'Neon branch lookup failed with HTTP 401: authentication failed',
      );
    });

    it('encodes shell-special Git names and never places them in the delete request', async (): Promise<void> => {
      // Supply a branch name that would be dangerous under expression-to-shell interpolation
      const headReference: string = 'feat/fix-$(touch owned);echo bad';
      const providerName: string = `preview/${headReference}`;
      const fetchMock: Mock<typeof fetch> = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json(buildBranchResponse(providerName)))
        .mockResolvedValueOnce(Response.json({}));
      const options: INeonPreviewCleanupOptions = buildOptions({
        fetchImpl: fetchMock,
        fetchPullRequest: vi.fn().mockResolvedValue({
          ...CLOSED_PULL_REQUEST,
          head: {
            ...CLOSED_PULL_REQUEST.head,
            ref: headReference,
          },
        }),
      });

      // Confirm lookup is URL-encoded and mutation addresses only the validated provider id
      await expect(runNeonPreviewCleanup(options)).resolves.toMatchObject({ deleted: true });
      const lookupUrl: URL = fetchMock.mock.calls[0]![0] as URL;
      expect(lookupUrl.searchParams.get('search')).toBe(providerName);
      expect(fetchMock.mock.calls[1]![0]).toBe(
        'https://console.neon.tech/api/v2/projects/red-mode-26063499/branches/br-small-rain-123456',
      );
    });
  });
});
