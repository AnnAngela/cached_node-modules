# AnnAngela/cached_node-modules

Caching for node_modules to save time, especially in Github-hosted Windows runner or other poor performance runner.

## Usage

### input

```yaml
- uses: AnnAngela/cached_node-modules@v2
  with:
    # The cache key used to restore and save cache
    # You can use magic variables to generate cache key for different OS, Node.js and NPM versions
    # See Section "Magic Variables" below to learn more
    cacheKey: cached_node-modules:{OS_NAME}:node@{NODE_VERSION_MAJOR}_{NODE_ARCH}:npm@{NPM_VERSION_MAJOR}:package-lock@{LOCKFILE_GIT_COMMIT_SHORT}{CUSTOM_VARIABLE}

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
steps:
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: 20
- uses: AnnAngela/cached_node-modules@v2
- run: npm test
```

### output

You can get these outputs from the action (The GitHub Actions output is always string):

* `cacheKey`: The generated cache key

  Example: `"cached_node-modules:linux:node@20_x64:npm@10:package-lock@1a2b3c4"`

* `variables`: A JSON string contains all the variables **used** in `cacheKey` (also included the variables used internally)

  Example: `"{\"OS_NAME\":\"linux\",\"NODE_VERSION\":\"v20.10.0\",\"NODE_VERSION_MAJOR\":\"20\",\"NODE_ARCH\":\"x64\",\"NPM_VERSION\":\"10.2.3\",\"NPM_VERSION_MAJOR\":\"10\",\"LOCKFILE_GIT_COMMIT_SHORT\":\"1a2b3c4\"}"`

* `cache-hit`: Whether the cache is hit

  Example: `"true"` or `"false"`

## Magic Variables

You can use these magic variables in the `cacheKey` to generate different cache keys for different OS, Node.js and NPM versions.

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

* `{NPM_VERSION}`:

  Description: The npm version, usually without `v` prefix

  Example: `10.2.3`

* `{NPM_VERSION_MAJOR}`:

  Description: The major version of npm

  Example: `10`

* `{NPM_VERSION_MINOR}`:

  Description: The minor version of npm

  Example: `2`

* `{NPM_VERSION_PATCH}`:

  Description: The patch version of npm

  Example: `3`

* `{LOCKFILE_GIT_COMMIT_LONG}`:

  Description: The commit hash of the lockfile, return `{LOCKFILE_HASH_SHA3_512}` instead if not in a git repo

  Example: `1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t`

* `{LOCKFILE_GIT_COMMIT_SHORT}`:

  Description: The abbreviated commit hash of the lockfile, return `{LOCKFILE_HASH_SHA3_512}` instead if not in a git repo

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

  Description: The commit hash of the package.json, return `{PACKAGEJSON_HASH_SHA3_512}` instead if not in a git repo

  Example: `1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t`

* `{PACKAGEJSON_GIT_COMMIT_SHORT}`:

  Description: The abbreviated commit hash of the package.json, return `{PACKAGEJSON_HASH_SHA3_512}` instead if not in a git repo

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

* `{LOCKFILE_GIT_COMMIT_LONG}` or `{LOCKFILE_GIT_COMMIT_SHORT}`: Prevent outdated cache for updated lockfile, you can also use hash variable of the lockfile.
* `{OS_NAME}`, `{NODE_VERSION_MAJOR}`(or `{NODE_VERSION}`), `{NODE_ARCH}`: Prevent imcompatible binary files from dependencies like `node-gyp`.
