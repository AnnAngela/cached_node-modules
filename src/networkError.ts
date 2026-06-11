/**
 * Node.js errno codes that indicate network/I/O failures.
 * These codes appear in stderr output across all package managers
 * (npm, Yarn Classic, Yarn Berry, pnpm) when network issues occur.
 *
 * Sources:
 * - npm:  `npm ERR! code <code>`
 * - Yarn Classic v1: `error An unexpected error occurred: "...: <code>"`
 * - Yarn Berry v2+: `➤ YN0001: │ GotError: connect <code>`
 * - pnpm: `ERR_PNPM_FETCH_* <code>: request to ... failed`
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
 * pnpm-specific network error prefixes.
 * pnpm emits structured error codes like ERR_PNPM_FETCH_404 when a package
 * cannot be fetched from the registry. These are distinct from the generic
 * Node.js errno codes and need to be explicitly matched.
 *
 * @see https://pnpm.io/next/errors
 */
const pnpmNetworkError = [
    "ERR_PNPM_FETCH_404",
    "ERR_PNPM_FETCH_001",
    "ERR_PNPM_FETCH_002",
    "ERR_PNPM_FETCH_003",
    "ERR_PNPM_FETCH_004",
    "ERR_PNPM_FETCH_005",
];

/**
 * Yarn Berry (v2+) network error patterns.
 *
 * Only codes that unambiguously indicate connectivity issues are listed.
 * YN0001 (generic exception — fires for incompatible Node, invalid
 * package.json, etc.) and YN0058 (peer-dependency resolution failure)
 * are excluded because retrying is pointless for permanent config errors.
 *
 * The bare Node.js errno codes in nodeNetworkErrors already cover raw
 * network failures (ECONNREFUSED, ETIMEDOUT) for Yarn Berry's stderr.
 * YN0049 is included as a Yarn-Berry-specific HTTP-connection-refused code
 * (e.g. GitHub Packages auth failure).
 *
 * @see https://yarnpkg.com/advanced/error-codes
 */
const yarnBerryNetworkError = [
    "YN0049",
];

/**
 * All network error patterns. Used in `spawnChildProcess.ts` via
 * `stderr.split("\n").some(line => networkError.some(pattern => line.includes(pattern)))`.
 *
 * Bare Node.js errno codes (ECONNREFUSED, ENOTFOUND, etc.) are NOT
 * included directly — they would match any context in stderr. Instead,
 * each package manager's prefixed pattern is listed separately:
 *   npm:       `npm ERR! code ECONNREFUSED`
 *   Yarn Cls:  `There appears to be trouble with your network connection. Retrying...`
 *   Yarn B:    `YN0049`
 *   pnpm:      `ERR_PNPM_FETCH_*`
 */
export default [
    ...npmNetworkError,
    ...yarnClassicNetworkError,
    ...yarnBerryNetworkError,
    ...pnpmNetworkError,
];
