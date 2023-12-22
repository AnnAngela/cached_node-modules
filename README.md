# AnnAngela/cached_node-modules

Caching for node_modules to save time, especially in Github-hosted Windows runner or other poor performance runner.

## Usage

### input

```yaml
- uses: actions/setup-node@v4
  with:
    # The cache key used to restore and save cache
    # You can use magic variables to generate cache key for different OS, Node.js and NPM versions
    # See Section "Magic Variables" below to learn more
    cacheKey: cached_node-modules:{OS_NAME}:node@{NODE_VERSION_MAJOR}_{NODE_ARCH}:npm@{NPM_VERSION_MAJOR}:package-lock@{LOCKFILE_GIT_COMMIT_SHORT}{CUSTOM_VARIABLE}

    # Used to fill the `CUSTOM_VARIABLE` variable to make the cache key unique
    customVariable: ''

    # The command to run if no cache found, usually `npm ci` or `yarn install --frozen-lockfile` or `pnpm install`
    command: npm ci

    # The working directory to run the command
    cwd: .

    # The path to the package-lock.json or yarn.lock file, it's relative to the `cwd`
    lockfilePath: package-lock.json
```

**Basic:**

```yaml
steps:
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: 18
- uses: AnnAngela/cached_node-modules@v1
- run: npm test
```

### output

You can get these outputs from the action:

| Key         | Description                                                 | Example                                                                                                                          |
| ----------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `cacheKey`  | The generated cache key                                     | `cached_node-modules:linux:node@20_x64:npm@10:package-lock@1a2b3c4`                                                              |
| `variables` | A JSON string contains all the variables used in `cacheKey` | `{"OS_NAME":"linux","NODE_VERSION_MAJOR":"20","NODE_ARCH":"x64","NPM_VERSION_MAJOR":"10","LOCKFILE_GIT_COMMIT_SHORT":"1a2b3c4"}` |

## Magic Variables

You can use these magic variables in the `cacheKey` to generate different cache keys for different OS, Node.js and NPM versions.

**Note**: These variables are fetched from the Node.js binary from `actions/setup-node` or from host runner. For example, if you setup node 16 via `actions/setup-node`, you will get `16` for `NODE_VERSION_MAJOR`.

| Key                           | Description                                                                                                                                                                                        | Example                                                                                                                            |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `{OS_NAME}`                   | The value identifying the operating system platform for which the Node.js binary was compiled, same as [`process.platform`](https://nodejs.org/docs/latest-v20.x/api/process.html#processplatform) | `linux`                                                                                                                            |
| `{NODE_ARCH}`                 | The value identifying the operating system CPU architecture for which the Node.js binary was compiled, same as [`process.arch`](https://nodejs.org/docs/latest-v20.x/api/process.html#processarch) | `x64`                                                                                                                              |
| `{NODE_VERSION}`              | The node version, usually with `v` prefix                                                                                                                                                          | `v20.10.0`                                                                                                                         |
| `{NODE_VERSION_MAJOR}`        | The major version of node                                                                                                                                                                          | `20`                                                                                                                               |
| `{NODE_VERSION_MINOR}`        | The minor version of node                                                                                                                                                                          | `10`                                                                                                                               |
| `{NODE_VERSION_PATCH}`        | The patch version of node                                                                                                                                                                          | `0`                                                                                                                                |
| `{NPM_VERSION}`               | The npm version, usually without `v` prefix                                                                                                                                                        | `10.2.3`                                                                                                                           |
| `{NPM_VERSION_MAJOR}`         | The major version of npm                                                                                                                                                                           | `10`                                                                                                                               |
| `{NPM_VERSION_MINOR}`         | The minor version of npm                                                                                                                                                                           | `2`                                                                                                                                |
| `{NPM_VERSION_PATCH}`         | The patch version of npm                                                                                                                                                                           | `3`                                                                                                                                |
| `{LOCKFILE_GIT_COMMIT_LONG}`  | The commit hash of the lockfile, return `{LOCKFILE_HASH_SHA3_512}` instead if not in a git repo                                                                                                    | `1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t`                                                                                         |
| `{LOCKFILE_GIT_COMMIT_SHORT}` | The abbreviated commit hash of the lockfile, return `{LOCKFILE_HASH_SHA3_512}` instead if not in a git repo                                                                                        | `1a2b3c4`                                                                                                                          |
| `{LOCKFILE_HASH_SHA2_256}`    | The SHA2-256 hash of the lockfile                                                                                                                                                                  | `1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1a2b3c4d5e6f7g8h9i0j1k2l`                                                                 |
| `{LOCKFILE_HASH_SHA2_512}`    | The SHA2-512 hash of the lockfile                                                                                                                                                                  | `1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x` |
| `{LOCKFILE_HASH_SHA3_256}`    | The SHA3-256 hash of the lockfile                                                                                                                                                                  | `1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1a2b3c4d5e6f7g8h9i0j1k2l`                                                                 |
| `{LOCKFILE_HASH_SHA3_512}`    | The SHA3-512 hash of the lockfile                                                                                                                                                                  | `1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x` |
| `{CUSTOM_VARIABLE}`           | Your `customVariable` input, can be empty                                                                                                                                                          | ``                                                                                                                                 |

## Best Practices

We recommend you to use these variables in the `cacheKey` to keep `node_modules` safe for working in different OS, Node.js and NPM versions:

* `{LOCKFILE_GIT_COMMIT_LONG}` or `{LOCKFILE_GIT_COMMIT_SHORT}`: Prevent outdated cache for updated lockfile, you can also use hash variable of the lockfile.
* `{OS_NAME}`, `{NODE_VERSION_MAJOR}`(or `{NODE_VERSION}`), `{NODE_ARCH}`: Prevent imcompatible binary files from dependencies like `node-gyp`.
