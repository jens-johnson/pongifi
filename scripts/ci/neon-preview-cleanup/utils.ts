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
 * █████████████████████████████████████ scripts/ci/neon-preview-cleanup/utils.ts ██████████████████████████████████████
 *
 * Guarded GitHub and Neon orchestration for retiring closed pull request databases.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import {
  NEON_API_ROOT,
  NEON_BRANCH_ID_PATTERN,
  PROTECTED_GIT_BRANCH_PREFIXES,
  PROTECTED_GIT_BRANCHES,
} from './constants.ts';
import type { INeonBranch, INeonPreviewCleanupOptions, INeonPreviewCleanupResult, IPullRequest } from './types.ts';

/**
 * Builds the Vercel-managed integration's Neon preview branch name for a Git branch.
 * @public
 * @function
 * @param headReference - The pull request's Git head branch
 * @returns The exact Neon preview branch name
 */
export function buildNeonPreviewBranchName(headReference: string): string {
  return `preview/${headReference}`;
}

/**
 * Determines whether a Git branch belongs to a retained environment or development namespace.
 * @public
 * @function
 * @param headReference - The pull request's Git head branch
 * @returns Whether cleanup must retain the branch
 */
export function isProtectedGitBranch(headReference: string): boolean {
  return (
    PROTECTED_GIT_BRANCHES.has(headReference) ||
    PROTECTED_GIT_BRANCH_PREFIXES.some((prefix: string): boolean => headReference.startsWith(prefix))
  );
}

/**
 * Deletes an eligible closed pull request's exact Neon preview branch.
 * @public
 * @function
 * @param options - Injected GitHub state readers, Neon credentials, and HTTP client
 * @throws When GitHub or Neon returns malformed data, configuration is missing, the project differs from the
 * configured integration, the provider branch is unsafe, or a provider request fails
 * @returns The explicit cleanup or skip outcome
 */
export async function runNeonPreviewCleanup(options: INeonPreviewCleanupOptions): Promise<INeonPreviewCleanupResult> {
  // Re-read the pull request before any provider access so a reopened or retargeted branch cannot be deleted
  const pullRequest: IPullRequest = validatePullRequest(await options.fetchPullRequest());

  if (pullRequest.state !== 'closed') {
    return buildSkippedResult(`pull request #${pullRequest.number} is ${pullRequest.state}, not closed`);
  }

  if (pullRequest.base.ref !== 'staging') {
    return buildSkippedResult(`pull request #${pullRequest.number} no longer targets staging`);
  }

  if (pullRequest.head.repo.full_name !== options.repository) {
    return buildSkippedResult(`pull request #${pullRequest.number} comes from a fork`);
  }

  if (isProtectedGitBranch(pullRequest.head.ref)) {
    return buildSkippedResult(`Git branch ${pullRequest.head.ref} is retained by policy`);
  }

  // Keep a Git branch alive while any open pull request still uses it
  const openPullRequests: IPullRequest[] = validatePullRequestList(
    await options.fetchOpenPullRequests(pullRequest.head.repo.owner.login, pullRequest.head.ref),
  );
  const hasOpenPullRequest: boolean = openPullRequests.some(
    (candidate: IPullRequest): boolean =>
      candidate.head.ref === pullRequest.head.ref && candidate.head.repo.full_name === options.repository,
  );

  if (hasOpenPullRequest) {
    return buildSkippedResult(`Git branch ${pullRequest.head.ref} still belongs to an open pull request`);
  }

  // Validate all owner-provided configuration before sending the credential to Neon
  const apiKey: string = validateRequiredConfig('NEON_API_KEY', options.apiKey);
  const projectId: string = validateRequiredConfig('NEON_PROJECT_ID', options.projectId);

  if (projectId !== options.expectedProjectId) {
    throw new Error(
      `NEON_PROJECT_ID targets ${projectId}; expected the connected Pongifi resource ${options.expectedProjectId}`,
    );
  }

  // Resolve the exact integration-created branch as structured provider data
  const branchName: string = buildNeonPreviewBranchName(pullRequest.head.ref);
  const branches: INeonBranch[] = await fetchNeonBranches(options.fetchImpl, apiKey, projectId, branchName);
  const matchingBranches: INeonBranch[] = branches.filter((branch: INeonBranch): boolean => branch.name === branchName);

  if (matchingBranches.length === 0) {
    return {
      deleted: false,
      message: `Neon branch ${branchName} is already absent; cleanup is complete`,
    };
  }

  if (matchingBranches.length !== 1) {
    throw new Error(`Neon returned ${matchingBranches.length} exact matches for ${branchName}; refusing deletion`);
  }

  const branch: INeonBranch = matchingBranches[0]!;

  if (branch.default || branch.primary || branch.protected) {
    throw new Error(`Neon branch ${branch.name} is default, primary, or protected; refusing deletion`);
  }

  if (!NEON_BRANCH_ID_PATTERN.test(branch.id)) {
    throw new Error(`Neon returned an invalid branch id for ${branch.name}; refusing deletion`);
  }

  // Close the lookup-to-delete race by checking GitHub state again immediately before mutation
  const finalPullRequest: IPullRequest = validatePullRequest(await options.fetchPullRequest());

  if (
    finalPullRequest.state !== 'closed' ||
    finalPullRequest.base.ref !== 'staging' ||
    finalPullRequest.head.ref !== pullRequest.head.ref ||
    finalPullRequest.head.repo.full_name !== options.repository
  ) {
    return buildSkippedResult(`pull request #${pullRequest.number} changed after provider lookup`);
  }

  const finalOpenPullRequests: IPullRequest[] = validatePullRequestList(
    await options.fetchOpenPullRequests(finalPullRequest.head.repo.owner.login, finalPullRequest.head.ref),
  );
  const finalOpenPullRequest: boolean = finalOpenPullRequests.some(
    (candidate: IPullRequest): boolean =>
      candidate.head.ref === finalPullRequest.head.ref && candidate.head.repo.full_name === options.repository,
  );

  if (finalOpenPullRequest) {
    return buildSkippedResult(`Git branch ${pullRequest.head.ref} gained an open pull request`);
  }

  // Delete only the validated provider id; raw event branch names never enter a shell or mutation path
  const deleted: boolean = await deleteNeonBranch(options.fetchImpl, apiKey, projectId, branch);

  return {
    deleted,
    message: deleted
      ? `Deleted Neon branch ${branch.name} (${branch.id}) for closed pull request #${pullRequest.number}`
      : `Neon branch ${branch.name} was already absent when deletion ran; cleanup is complete`,
  };
}

/**
 * Builds a non-mutating workflow result.
 * @internal
 * @function
 * @param reason - The guard condition that prevented cleanup
 * @returns The explicit skip result
 */
function buildSkippedResult(reason: string): INeonPreviewCleanupResult {
  return {
    deleted: false,
    message: `Skipped Neon preview cleanup: ${reason}`,
  };
}

/**
 * Deletes one validated Neon branch id.
 * @internal
 * @function
 * @param fetchImpl - The injected HTTP client
 * @param apiKey - The Neon API credential
 * @param projectId - The verified Neon project id
 * @param branch - The exact structured branch selected for deletion
 * @throws When Neon rejects the request or the network call fails
 * @returns Whether Neon deleted an existing branch
 */
async function deleteNeonBranch(
  fetchImpl: typeof fetch,
  apiKey: string,
  projectId: string,
  branch: INeonBranch,
): Promise<boolean> {
  const requestUrl: string = `${NEON_API_ROOT}/projects/${encodeURIComponent(projectId)}/branches/${encodeURIComponent(branch.id)}`;
  const response: Response = await fetchImpl(requestUrl, {
    headers: buildNeonHeaders(apiKey),
    method: 'DELETE',
  });

  if (response.status === 204 || response.status === 404) {
    return false;
  }

  if (response.ok) {
    return true;
  }

  throw new Error(`Neon branch deletion failed with HTTP ${response.status}: ${await readProviderError(response)}`);
}

/**
 * Fetches Neon branches matching a preview name.
 * @internal
 * @function
 * @param fetchImpl - The injected HTTP client
 * @param apiKey - The Neon API credential
 * @param projectId - The verified Neon project id
 * @param branchName - The exact integration-created branch name
 * @throws When Neon rejects the request or returns malformed data
 * @returns The validated active branch records
 */
async function fetchNeonBranches(
  fetchImpl: typeof fetch,
  apiKey: string,
  projectId: string,
  branchName: string,
): Promise<INeonBranch[]> {
  const requestUrl: URL = new URL(`${NEON_API_ROOT}/projects/${encodeURIComponent(projectId)}/branches`);
  requestUrl.searchParams.set('include_deleted', 'false');
  requestUrl.searchParams.set('limit', '10000');
  requestUrl.searchParams.set('search', branchName);

  const response: Response = await fetchImpl(requestUrl, {
    headers: buildNeonHeaders(apiKey),
  });

  if (!response.ok) {
    throw new Error(`Neon branch lookup failed with HTTP ${response.status}: ${await readProviderError(response)}`);
  }

  return validateNeonBranchList(await response.json());
}

/**
 * Builds the fixed Neon API request headers without exposing the credential in URLs or logs.
 * @internal
 * @function
 * @param apiKey - The Neon API credential
 * @returns The request headers
 */
function buildNeonHeaders(apiKey: string): Record<string, string> {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
}

/**
 * Reads a bounded provider error message without reflecting arbitrary response data.
 * @internal
 * @function
 * @param response - The failed provider response
 * @returns A safe diagnostic message
 */
async function readProviderError(response: Response): Promise<string> {
  const body: unknown = await response.json().catch((): null => null);

  if (isRecord(body) && typeof body.message === 'string') {
    return body.message.slice(0, 300);
  }

  return 'provider returned no diagnostic message';
}

/**
 * Validates a Neon branch-list response.
 * @internal
 * @function
 * @param value - The untrusted response body
 * @throws When the response shape is malformed
 * @returns The validated branch records
 */
function validateNeonBranchList(value: unknown): INeonBranch[] {
  if (!isRecord(value) || !Array.isArray(value.branches)) {
    throw new Error('Neon branch lookup returned a malformed response');
  }

  return value.branches.map((branch: unknown): INeonBranch => validateNeonBranch(branch));
}

/**
 * Validates one Neon branch record.
 * @internal
 * @function
 * @param value - The untrusted branch value
 * @throws When required branch safety fields are missing
 * @returns The validated branch record
 */
function validateNeonBranch(value: unknown): INeonBranch {
  if (
    !isRecord(value) ||
    typeof value.default !== 'boolean' ||
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.primary !== 'boolean' ||
    typeof value.protected !== 'boolean'
  ) {
    throw new Error('Neon returned a malformed branch record');
  }

  return {
    default: value.default,
    id: value.id,
    name: value.name,
    primary: value.primary,
    protected: value.protected,
  };
}

/**
 * Validates one GitHub pull request record.
 * @internal
 * @function
 * @param value - The untrusted GitHub response value
 * @throws When required lifecycle fields are missing
 * @returns The validated pull request record
 */
function validatePullRequest(value: unknown): IPullRequest {
  if (
    !isRecord(value) ||
    !isRecord(value.base) ||
    typeof value.base.ref !== 'string' ||
    !isRecord(value.head) ||
    typeof value.head.ref !== 'string' ||
    !isRecord(value.head.repo) ||
    typeof value.head.repo.full_name !== 'string' ||
    !isRecord(value.head.repo.owner) ||
    typeof value.head.repo.owner.login !== 'string' ||
    typeof value.number !== 'number' ||
    typeof value.state !== 'string'
  ) {
    throw new Error('GitHub returned a malformed pull request record');
  }

  return {
    base: {
      ref: value.base.ref,
    },
    head: {
      ref: value.head.ref,
      repo: {
        full_name: value.head.repo.full_name,
        owner: {
          login: value.head.repo.owner.login,
        },
      },
    },
    number: value.number,
    state: value.state,
  };
}

/**
 * Validates a GitHub pull request list.
 * @internal
 * @function
 * @param value - The untrusted GitHub response value
 * @throws When the list shape is malformed
 * @returns The validated pull request records
 */
function validatePullRequestList(value: unknown): IPullRequest[] {
  if (!Array.isArray(value)) {
    throw new Error('GitHub returned a malformed open pull request list');
  }

  return value.map((pullRequest: unknown): IPullRequest => validatePullRequest(pullRequest));
}

/**
 * Validates one required workflow configuration value.
 * @internal
 * @function
 * @param name - The repository secret or variable name
 * @param value - The configured value
 * @throws When the value is missing
 * @returns The non-empty value
 */
function validateRequiredConfig(name: string, value: string | undefined): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} is not configured; add it in GitHub Actions repository settings`);
  }

  return value;
}

/**
 * Narrows an unknown value to a string-keyed record.
 * @internal
 * @function
 * @param value - The unknown value
 * @returns Whether the value is a non-null object
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
