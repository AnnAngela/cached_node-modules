import { debug, warning } from "@actions/core";
import semver from "semver";
import spawnChildProcess from "./spawnChildProcess.js";
import { hashCalc } from "./hashCalc.js";
import octokit from "./Octokit.js";

const fetchFileGitCommitLong = async (filePath: string) => {
    debug(`[fetchFileGitCommitLong] Fetching git commit long of ${filePath}...`);
    debug(`[fetchFileGitCommitLong] octokit.context.repo: ${JSON.stringify(octokit.context.repo)}`);
    debug(`[fetchFileGitCommitLong] octokit.context.ref: ${JSON.stringify(octokit.context.ref)}`);
    debug(`[fetchFileGitCommitLong] octokit.context.sha: ${JSON.stringify(octokit.context.sha)}`);
    // Anchor the listCommits query to context.sha (the run's checked-out
    // commit), NOT context.ref. context.ref is a stable string such as
    // "refs/heads/master", and listCommits resolves it against the *remote
    // HEAD at the moment of the API call* — which drifts away from the
    // checked-out commit when multiple commits land on the branch in quick
    // succession. Under that race, an earlier run could resolve ref to a
    // later commit and persist its own (older) install result under the
    // newer commit's cacheKey, deserialising a node_modules that does not
    // match the lockfile that key points at. Pinning to context.sha keeps
    // the git-commit anchor aligned with the working tree this run actually
    // built against.
    const { data: [{ sha }] } = await octokit.repos.listCommits({
        ...octokit.context.repo,
        path: filePath,
        per_page: 1,
        sha: octokit.context.sha,
    });
    debug(`[fetchFileGitCommitLong] Fetched git commit long of ${filePath}: ${sha}`);
    return sha;
};

// Minimal interface describing what resolvers need from a Variable instance.
// Decouples variableFunction from the Variable class so that the static
// VARIABLE_MAP_BASE initializer doesn't form a self-referential type cycle.
export interface VariableInput {
    readonly cwd: string;
    readonly lockfilePath: string;
    readonly packageJsonPath: string;
    readonly customVariable: string;
    readonly packageManager: string;
    get(name: string): Promise<string>;
}

type variableFunction = (variable: VariableInput) => Promise<string>;

// Mapping from package manager to lockfile name (with extension).
// Used by the {LOCKFILE} magic variable resolver.
const PM_LOCKFILE_MAP: Record<string, string> = {
    npm: "package-lock.json",
    pnpm: "pnpm-lock.yaml",
    yarn: "yarn.lock",
};

// Resolves PM_VERSION, parses it as semver, and returns the requested component.
// Used by PM_VERSION_MAJOR/MINOR/PATCH resolvers — extracted as a module-level
// function so it is available at VARIABLE_MAP_BASE initialization time.
const resolvePMVersionComponent = async (v: VariableInput, component: "major" | "minor" | "patch"): Promise<string> => {
    const version = await v.get("PM_VERSION");
    const parsed = semver.parse(version);
    if (!parsed) {
        throw new Error(`Failed to parse "${v.packageManager}" version "${version}" as semver.`);
    }
    return `${parsed[component]}`;
};

export default class Variable implements VariableInput {
    // All variable resolvers live in one map — no more special-cased if/else
    // branches in get(). Adding a new variable only requires a new entry here.
    // Uses `satisfies` to validate each resolver's type while preserving the
    // exact object literal shape for VariableName's precise union type.
    static readonly VARIABLE_MAP_BASE = {
        // ── OS / Node ──
        OS_NAME: (v: VariableInput) => spawnChildProcess("node --eval=\"console.info(process.platform)\"", { cwd: v.cwd }),
        NODE_ARCH: (v: VariableInput) => spawnChildProcess("node --eval=\"console.info(process.arch)\"", { cwd: v.cwd }),
        NODE_VERSION: (v: VariableInput) => spawnChildProcess("node --version", { cwd: v.cwd }),
        NODE_VERSION_MAJOR: async (v: VariableInput) => `${semver.major(await v.get("NODE_VERSION"))}`,
        NODE_VERSION_MINOR: async (v: VariableInput) => `${semver.minor(await v.get("NODE_VERSION"))}`,
        NODE_VERSION_PATCH: async (v: VariableInput) => `${semver.patch(await v.get("NODE_VERSION"))}`,

        // ── Package manager identity ──
        CUSTOM_VARIABLE: (v: VariableInput) => Promise.resolve(v.customVariable),
        PM: (v: VariableInput) => Promise.resolve(v.packageManager),
        LOCKFILE: (v: VariableInput) => Promise.resolve(PM_LOCKFILE_MAP[v.packageManager] ?? "package-lock.json"),

        // ── Package manager version ──
        PM_VERSION: (v: VariableInput) => spawnChildProcess(`${v.packageManager} --version`, { cwd: v.cwd }),
        PM_VERSION_MAJOR: (v: VariableInput) => resolvePMVersionComponent(v, "major"),
        PM_VERSION_MINOR: (v: VariableInput) => resolvePMVersionComponent(v, "minor"),
        PM_VERSION_PATCH: (v: VariableInput) => resolvePMVersionComponent(v, "patch"),

        // ── Deprecated: NPM_* → PM_* (backward compatibility) ──
        // These variables were renamed to PM_VERSION / PM_VERSION_MAJOR / etc.
        // for multi-package-manager support (npm / pnpm / yarn).
        // Resolvers delegate to the canonical PM_* names; core.warning is
        // emitted on first use. The Variable cache ensures the warning
        // fires at most once per variable per run.
        NPM_VERSION: async (v: VariableInput) => {
            warning('"{NPM_VERSION}" is deprecated, use "{PM_VERSION}" instead.');
            return v.get("PM_VERSION");
        },
        NPM_VERSION_MAJOR: async (v: VariableInput) => {
            warning('"{NPM_VERSION_MAJOR}" is deprecated, use "{PM_VERSION_MAJOR}" instead.');
            return v.get("PM_VERSION_MAJOR");
        },
        NPM_VERSION_MINOR: async (v: VariableInput) => {
            warning('"{NPM_VERSION_MINOR}" is deprecated, use "{PM_VERSION_MINOR}" instead.');
            return v.get("PM_VERSION_MINOR");
        },
        NPM_VERSION_PATCH: async (v: VariableInput) => {
            warning('"{NPM_VERSION_PATCH}" is deprecated, use "{PM_VERSION_PATCH}" instead.');
            return v.get("PM_VERSION_PATCH");
        },

        // ── Lockfile hash / git ──
        LOCKFILE_HASH_SHA2_256: (v: VariableInput) => hashCalc(v.lockfilePath, "SHA2_256"),
        LOCKFILE_HASH_SHA2_512: (v: VariableInput) => hashCalc(v.lockfilePath, "SHA2_512"),
        LOCKFILE_HASH_SHA3_256: (v: VariableInput) => hashCalc(v.lockfilePath, "SHA3_256"),
        LOCKFILE_HASH_SHA3_512: (v: VariableInput) => hashCalc(v.lockfilePath, "SHA3_512"),
        LOCKFILE_GIT_COMMIT_LONG: (v: VariableInput) => fetchFileGitCommitLong(v.lockfilePath),
        LOCKFILE_GIT_COMMIT_SHORT: async (v: VariableInput) => (await fetchFileGitCommitLong(v.lockfilePath)).slice(0, 7),

        // ── package.json hash / git ──
        PACKAGEJSON_HASH_SHA2_256: (v: VariableInput) => hashCalc(v.packageJsonPath, "SHA2_256"),
        PACKAGEJSON_HASH_SHA2_512: (v: VariableInput) => hashCalc(v.packageJsonPath, "SHA2_512"),
        PACKAGEJSON_HASH_SHA3_256: (v: VariableInput) => hashCalc(v.packageJsonPath, "SHA3_256"),
        PACKAGEJSON_HASH_SHA3_512: (v: VariableInput) => hashCalc(v.packageJsonPath, "SHA3_512"),
        PACKAGEJSON_GIT_COMMIT_LONG: (v: VariableInput) => fetchFileGitCommitLong(v.packageJsonPath),
        PACKAGEJSON_GIT_COMMIT_SHORT: async (v: VariableInput) => (await fetchFileGitCommitLong(v.packageJsonPath)).slice(0, 7),
    } satisfies Record<string, variableFunction>;

    private readonly cache: Record<string, string> = {};

    constructor(
        public readonly cwd: string,
        public readonly lockfilePath: string,
        public readonly packageJsonPath: string,
        public readonly customVariable: string,
        public readonly packageManager: string,
    ) {}

    getCache(): Readonly<Record<string, string>> {
        return Object.freeze({ ...this.cache });
    }

    /**
     * Type guard: checks whether `name` is a recognised variable name
     * that can be passed to {@link Variable.get}. Derived automatically
     * from the keys of {@link VARIABLE_MAP_BASE} — no manual maintenance
     * needed when adding new variables.
     */
    static isVariableName = (name: string): name is VariableName =>
        Reflect.has(Variable.VARIABLE_MAP_BASE, name);

    async get(variableName: VariableName): Promise<string> {
        debug(`[Variable] variableName: ${variableName}`);

        // Check cache — derived variables (e.g. NODE_VERSION_MAJOR, PM_VERSION_MAJOR)
        // return cached values without calling their resolver, which would recursively
        // call get() for the base version variable.
        const cached = this.cache[variableName];
        if (typeof cached === "string") {
            debug(`[Variable] variableName: ${variableName} is in cache, returning cached value: ${cached}`);
            return cached;
        }

        const resolver = Variable.VARIABLE_MAP_BASE[variableName];
        const result = await resolver(this);
        this.cache[variableName] = result;
        debug(`[Variable] variableName ${variableName} caches result: ${result}`);
        return result;
    }
}

// VariableName is derived from VARIABLE_MAP_BASE keys — a precise union of
// literal string types. Adding a new variable to the map automatically
// includes it here with no manual maintenance.
export type VariableName = keyof typeof Variable.VARIABLE_MAP_BASE;
