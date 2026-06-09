/**
 * Node.js errno codes that indicate network/I/O failures.
 * These codes appear in stderr output across all package managers
 * (npm, Yarn Classic, Yarn Berry, pnpm) when network issues occur.
 *
 * Sources:
 * - npm:  `npm ERR! code <code>`
 * - Yarn Classic v1: `error An unexpected error occurred: "...: <code>"`
 * - Yarn Berry v2+: `➤ YN0001: │ GotError: connect <code>`
 * - pnpm: `ERR_PNPM_FETCH_*  <code>: request to ... failed`
 *
 * @see https://nodejs.org/api/errors.html#common-system-errors
 */
const nodeNetworkErrors = [
    "ECONNREFUSED",
    "ECONNRESET",
    "ENOTFOUND",
    "EPIPE",
    "ETIMEDOUT",
] as const;

/** npm prefixes its errors with `npm ERR! code <code>` for structured output */
const npmNetworkError = nodeNetworkErrors.map(
    (errorCode) => `npm ERR! code ${errorCode}`,
);

/**
 * Yarn Classic v1 unique network error pattern.
 * This message appears when yarn detects connectivity issues during parallel downloads.
 *
 * @see https://classic.yarnpkg.com/en/docs/cli/install#toc-yarn-install
 */
const yarnClassicNetworkError = [
    "There appears to be trouble with your network connection. Retrying...",
];

/**
 * All network error patterns. Used in `spawnChildProcess.ts` via
 * `networkError.some((pattern) => stderr.includes(pattern))`.
 *
 * Design note: Node.js errno codes (ECONNREFUSED, ETIMEDOUT, etc.) are included
 * as bare strings because they reliably indicate network failures in stderr,
 * regardless of which package manager produced them. The manager-specific
 * prefixes (npm ERR!, YN0001, etc.) are added for npm context where the errno
 * codes alone might not be sufficient to distinguish from other errors in
 * npm's structured output format.
 */
export default [
    ...npmNetworkError,
    ...yarnClassicNetworkError,
    ...nodeNetworkErrors,
];
