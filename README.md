# AnnAngela/cached_node-modules

Caching for node_modules to save time, especially in Github-hosted Windows runner or other poor performance runner.

> **📦 从 v5 升级到 v6？** 请阅读 [MIGRATION-v6.md](MIGRATION-v6.md) 了解分步骤迁移指引。

## Usage

### input

```yaml
- uses: AnnAngela/cached_node-modules@v2
  with:
    # The cache key used to restore and save cache
    # You can use magic variables to generate cache key for different OS, Node.js and package manager versions
    # See Section "Magic Variables" below to learn more
    cacheKey: cached_node-modules:{OS_NAME}:node@{NODE_VERSION_MAJOR}_{NODE_ARCH}:{PM}@{PM_VERSION_MAJOR}:{LOCKFILE}@{LOCKFILE_HASH_SHA2_256}{CUSTOM_VARIABLE}

    # Used to fill the `CUSTOM_VARIABLE` variable to make the cache key unique
    # See Section "Custom Variables" below to learn more
    customVariable: ''

    # The command to run if no cache found, usually `npm ci` or `yarn install --frozen-lockfile` or `pnpm install`
    # Please be reminded that this command will be parsed by `shell-quote` so you should avoid using special characters
    command: npm ci

    # The working directory to run the command
    cwd: .

    # The path to the package-lock.json or yarn.lock file, it's relative to the `cwd`
    lockfilePath: package-lock.json

    # The path to the package.json file, it's relative to the `cwd`
    packageJsonPath: package.json

    # The retry time when network error occurs while running the command, `0` means no retry
    networkErrorRetryTime: 3

    # The GitHub token used to fetch commit for files, usually `${{ secrets.GITHUB_TOKEN }}` or `${{ github.token }}`
    githubToken: ${{ secrets.GITHUB_TOKEN }}
```

**Basic:**

```yaml
permissions:
  contents: read
  actions: write # Required to delete cache when workflow fails after creating new cache
steps:
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: 24
- uses: AnnAngela/cached_node-modules@v2
- run: npm test
```

### output

You can get these outputs from the action (The GitHub Actions output is always string):

* `cacheKey`: The generated cache key

  Example: `"cached_node-modules:linux:node@20_x64:npm@10:package-lock.json@9f2c1a4b8e7d6035c1f2a9b8e7d6035c1f2a9b8e7d6035c1f2a9b8e7d6035c1f2"`

* `variables`: A JSON string contains all the variables **used** in `cacheKey` (also included the variables used internally)

  Example: `"{\"OS_NAME\":\"linux\",\"NODE_VERSION\":\"v20.10.0\",\"NODE_VERSION_MAJOR\":\"20\",\"NODE_ARCH\":\"x64\",\"PM\":\"npm\",\"PM_VERSION\":\"10.2.3\",\"PM_VERSION_MAJOR\":\"10\",\"LOCKFILE_HASH_SHA2_256\":\"9f2c1a4b8e7d6035c1f2a9b8e7d6035c1f2a9b8e7d6035c1f2a9b8e7d6035c1f2\"}"`

* `cache-hit`: Whether the cache is hit

  Example: `"true"` or `"false"`

When this action creates a new cache entry and the workflow later fails, the action will attempt to delete that cache in its `post` step to avoid keeping a broken cache for subsequent runs.

> ***Note: Deleting caches via the GitHub Actions API requires a token with `actions: write` permission. If your workflow does not grant this (for example, on pull requests from forks where `${{ secrets.GITHUB_TOKEN }}` is more restricted), the post step will log a warning and the cache may not be deleted.***

## Magic Variables

You can use these magic variables in the `cacheKey` to generate different cache keys for different OS, Node.js and package manager versions.

**Note**: These variables are fetched from the Node.js binary from `actions/setup-node` or from host runner. For example, if you setup node 16 via `actions/setup-node`, you will get `16` for `NODE_VERSION_MAJOR`.

<details><summary>Magic Variables List</summary>

* `{OS_NAME}`:

  Description: The value identifying the operating system platform for which the Node.js binary was compiled, same as [`process.platform`](https://nodejs.org/docs/latest-v20.x/api/process.html#processplatform)

  Example: `linux`

* `{NODE_ARCH}`:

  Description: The value identifying the operating system CPU architecture for which the Node.js binary was compiled, same as [`process.arch`](https://nodejs.org/docs/latest-v20.x/api/process.html#processarch)

  Example: `x64`

* `{NODE_VERSION}`:

  Description: The node version, usually with `v` prefix

  Example: `v20.10.0`

* `{NODE_VERSION_MAJOR}`:

  Description: The major version of node

  Example: `20`

* `{NODE_VERSION_MINOR}`:

  Description: The minor version of node

  Example: `10`

* `{NODE_VERSION_PATCH}`:

  Description: The patch version of node

  Example: `0`

* `{PM}`:

  Description: The package manager in use, determined by the `packageManager` input

  Example: `npm`, `pnpm`, or `yarn`

* `{PM_VERSION}`:

  Description: The package manager version, usually without `v` prefix. (Legacy names `{NPM_VERSION}`, `{NPM_VERSION_MAJOR}`, etc. are still supported but deprecated — prefer `{PM_*}`.)

  Example: `10.2.3`

* `{PM_VERSION_MAJOR}`:

  Description: The major version of the package manager

  Example: `10`

* `{PM_VERSION_MINOR}`:

  Description: The minor version of the package manager

  Example: `2`

* `{PM_VERSION_PATCH}`:

  Description: The patch version of the package manager

  Example: `3`

* `{LOCKFILE}`:

  Description: The lockfile name (with extension), determined by the `packageManager` input. Useful to distinguish lockfile types in the cache key.

  Example: `package-lock.json` (npm), `pnpm-lock.yaml` (pnpm), or `yarn.lock` (yarn)

* `{LOCKFILE_GIT_COMMIT_LONG}`:

  Description: The commit hash that last touched the lockfile, queried via the GitHub API and anchored to the current run's checked-out commit (`github.sha`). Requires the `githubToken` to have `contents: read`. Unlike the hash variables, this fetches commit metadata from the API rather than reading the local file — if the API call fails (e.g. no token, insufficient scope, or a non-git context), the variable resolves to an error. Prefer `{LOCKFILE_HASH_SHA2_256}` unless you specifically need commit identity.

  Example: `1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t`

* `{LOCKFILE_GIT_COMMIT_SHORT}`:

  Description: The abbreviated (7-char) commit hash that last touched the lockfile, queried via the GitHub API and anchored to the current run's checked-out commit (`github.sha`). Same requirements and caveats as `{LOCKFILE_GIT_COMMIT_LONG}`.

  Example: `1a2b3c4`

* `{LOCKFILE_HASH_SHA2_256}`:

  Description: The SHA2-256 hash of the lockfile

  Example: `1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1a2b3c4d5e6f7g8h9i0j1k2l`

* `{LOCKFILE_HASH_SHA2_512}`:

  Description: The SHA2-512 hash of the lockfile

  Example: `1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x`

* `{LOCKFILE_HASH_SHA3_256}`:

  Description: The SHA3-256 hash of the lockfile

  Example: `1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1a2b3c4d5e6f7g8h9i0j1k2l`

* `{LOCKFILE_HASH_SHA3_512}`:

  Description: The SHA3-512 hash of the lockfile

  Example: `1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x`

* `{PACKAGEJSON_GIT_COMMIT_LONG}`:

  Description: The commit hash that last touched the package.json, queried via the GitHub API and anchored to the current run's checked-out commit (`github.sha`). Requires the `githubToken` to have `contents: read`. If the API call fails (no token, insufficient scope, or a non-git context), the variable resolves to an error. Prefer `{PACKAGEJSON_HASH_SHA2_256}` unless you specifically need commit identity.

  Example: `1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t`

* `{PACKAGEJSON_GIT_COMMIT_SHORT}`:

  Description: The abbreviated (7-char) commit hash that last touched the package.json, queried via the GitHub API and anchored to the current run's checked-out commit (`github.sha`). Same requirements and caveats as `{PACKAGEJSON_GIT_COMMIT_LONG}`.

  Example: `1a2b3c4`

* `{PACKAGEJSON_HASH_SHA2_256}`:

  Description: The SHA2-256 hash of the package.json

  Example: `1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1a2b3c4d5e6f7g8h9i0j1k2l`

* `{PACKAGEJSON_HASH_SHA2_512}`:

  Description: The SHA2-512 hash of the package.json

  Example: `1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x`

* `{PACKAGEJSON_HASH_SHA3_256}`:

  Description: The SHA3-256 hash of the package.json

  Example: `1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1a2b3c4d5e6f7g8h9i0j1k2l`

* `{PACKAGEJSON_HASH_SHA3_512}`:

  Description: The SHA3-512 hash of the package.json

  Example: `1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x`

* `{CUSTOM_VARIABLE}`:

  Description: Your `customVariable` input, can be empty

  Example: (empty)

</details>

## Custom Variables

You can use this to prevent incompatible cache. For example, you can use these config to prevent outdated cache for updated patches used for [patch-package](https://www.npmjs.com/package/patch-package):

```yaml
steps:
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: 20

- uses: AnnAngela/cached_node-modules@v2
  with:
    customVariable: :patches@${{ hashFiles('patches/**') }}

- run: npm test
```

## Best Practices

We recommend you to use these variables in the `cacheKey` to keep `node_modules` safe for working in different OS, Node.js and NPM versions:

* `{LOCKFILE_HASH_SHA2_256}` (or another lockfile hash variable): Prevent stale cache when the lockfile changes. The hash is computed from the local checked-out lockfile content with irrelevant fields stripped (e.g. `packages[""]`, pnpm `snapshots`/`time`, yarn `__metadata`), so it is stable across unrelated metadata churn. This is the default anchor in `cacheKey`.

  `{LOCKFILE_GIT_COMMIT_LONG}` / `{LOCKFILE_GIT_COMMIT_SHORT}` are also available and now anchor to the run's checked-out commit (`github.sha`) rather than the live branch tip, but they query the GitHub API (network + `contents: read` scope) and resolve to an error if the API call fails. Prefer the hash variables unless you specifically need commit identity.
* `{OS_NAME}`, `{NODE_VERSION_MAJOR}`(or `{NODE_VERSION}`), `{NODE_ARCH}`: Prevent imcompatible binary files from dependencies like `node-gyp`.

## Releases

Releases are automated with [release-please](https://github.com/googleapis/release-please). The flow is:

1. Commits following [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, etc.) land on `master`.
2. release-please opens and keeps updated a **Release PR** that bumps the version in `package.json` and appends to `CHANGELOG.md`.
3. A maintainer reviews and **merges the Release PR**.
4. Merging pushes the bumped `package.json`, which triggers the `publish` workflow: it runs tests, builds `dist/`, then creates the version tag, the GitHub Release, and moves the rolling major tag — all via the GitHub API (commits/tags are `Verified`).
5. The rolling major tag (`v6`) always points to the latest release of that major version.

> **Tip:** Pin to a precise tag (e.g. `@v6.0.1`) or a commit SHA for reproducibility. The rolling major tag (`@v6`) tracks the latest but is force-updated on each release.
