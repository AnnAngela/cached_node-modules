import { debug } from "@actions/core";
import semver from "semver";
import spawnChildProcess from "./spawnChildProcess.js";
import { hashCalc } from "./hashCalc.js";
import octokit from "./Octokit.js";

const fetchFileGitCommitLong = async (filePath: string) => {
    debug(`[fetchFileGitCommitLong] Fetching git commit long of ${filePath}...`);
    debug(`[fetchFileGitCommitLong] octokit.context.repo: ${JSON.stringify(octokit.context.repo)}`);
    debug(`[fetchFileGitCommitLong] octokit.context.ref: ${JSON.stringify(octokit.context.ref)}`);
    debug(`[fetchFileGitCommitLong] octokit.context.sha: ${JSON.stringify(octokit.context.sha)}`);
    const { data: [{ sha }] } = await octokit.repos.listCommits({
        ...octokit.context.repo,
        path: filePath,
        per_page: 1,
        sha: octokit.context.ref,
    });
    debug(`[fetchFileGitCommitLong] Fetched git commit long of ${filePath}: ${sha}`);
    return sha;
};

// Each resolver receives the Variable instance and extracts whatever fields it needs.
// This eliminates the need for a separate dispatch method (runFunctionBasedOnVariableName).
type variableFunction = (variable: Variable) => Promise<string>;

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
const resolvePMVersionComponent = async (v: Variable, component: "major" | "minor" | "patch"): Promise<string> => {
    const version = await v.get("PM_VERSION");
    const parsed = semver.parse(version);
    if (!parsed) {
        throw new Error(`Failed to parse "${v.packageManager}" version "${version}" as semver.`);
    }
    return `${parsed[component]}`;
};

export default class Variable {
    // All variable resolvers live in one map — no more special-cased if/else
    // branches in get(). Adding a new variable only requires a new entry here.
    // Not private so that the exported VariableName type can derive from its keys.
    static readonly VARIABLE_MAP_BASE: Record<string, variableFunction> = {
        // ── OS / Node ──
        OS_NAME: (v) => spawnChildProcess("node --eval=\"console.info(process.platform)\"", { cwd: v.cwd }),
        NODE_ARCH: (v) => spawnChildProcess("node --eval=\"console.info(process.arch)\"", { cwd: v.cwd }),
        NODE_VERSION: (v) => spawnChildProcess("node --version", { cwd: v.cwd }),
        NODE_VERSION_MAJOR: async (v) => `${semver.major(await v.get("NODE_VERSION"))}`,
        NODE_VERSION_MINOR: async (v) => `${semver.minor(await v.get("NODE_VERSION"))}`,
        NODE_VERSION_PATCH: async (v) => `${semver.patch(await v.get("NODE_VERSION"))}`,

        // ── Package manager identity ──
        CUSTOM_VARIABLE: (v) => Promise.resolve(v.customVariable),
        PM: (v) => Promise.resolve(v.packageManager),
        LOCKFILE: (v) => Promise.resolve(PM_LOCKFILE_MAP[v.packageManager] ?? "package-lock.json"),

        // ── Package manager version ──
        PM_VERSION: (v) => spawnChildProcess(`${v.packageManager} --version`, { cwd: v.cwd }),
        PM_VERSION_MAJOR: (v) => resolvePMVersionComponent(v, "major"),
        PM_VERSION_MINOR: (v) => resolvePMVersionComponent(v, "minor"),
        PM_VERSION_PATCH: (v) => resolvePMVersionComponent(v, "patch"),

        // ── Lockfile hash / git ──
        LOCKFILE_HASH_SHA2_256: (v) => hashCalc(v.lockfilePath, "SHA2_256"),
        LOCKFILE_HASH_SHA2_512: (v) => hashCalc(v.lockfilePath, "SHA2_512"),
        LOCKFILE_HASH_SHA3_256: (v) => hashCalc(v.lockfilePath, "SHA3_256"),
        LOCKFILE_HASH_SHA3_512: (v) => hashCalc(v.lockfilePath, "SHA3_512"),
        LOCKFILE_GIT_COMMIT_LONG: (v) => fetchFileGitCommitLong(v.lockfilePath),
        LOCKFILE_GIT_COMMIT_SHORT: async (v) => (await fetchFileGitCommitLong(v.lockfilePath)).slice(0, 7),

        // ── package.json hash / git ──
        PACKAGEJSON_HASH_SHA2_256: (v) => hashCalc(v.packageJsonPath, "SHA2_256"),
        PACKAGEJSON_HASH_SHA2_512: (v) => hashCalc(v.packageJsonPath, "SHA2_512"),
        PACKAGEJSON_HASH_SHA3_256: (v) => hashCalc(v.packageJsonPath, "SHA3_256"),
        PACKAGEJSON_HASH_SHA3_512: (v) => hashCalc(v.packageJsonPath, "SHA3_512"),
        PACKAGEJSON_GIT_COMMIT_LONG: (v) => fetchFileGitCommitLong(v.packageJsonPath),
        PACKAGEJSON_GIT_COMMIT_SHORT: async (v) => (await fetchFileGitCommitLong(v.packageJsonPath)).slice(0, 7),
    };

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

        // 1. Check cache — PM_VERSION_MAJOR/MINOR/PATCH and NODE_VERSION_MAJOR/MINOR/PATCH
        //    return cached derived values without calling their resolver (which would
        //    call get() recursively to fetch the base version again).
        const cached = this.cache[variableName];
        if (typeof cached === "string") {
            debug(`[Variable] variableName: ${variableName} is in cache, returning cached value: ${cached}`);
            return cached;
        }

        // 2. Look up the resolver — if missing, the VariableName type guard was bypassed.
        const resolver = Variable.VARIABLE_MAP_BASE[variableName];
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- the type guard can be bypassed at runtime
        if (!resolver) {
            throw new Error(`Variable "${variableName}" is not defined.`);
        }

        // 3. Resolve and cache.
        debug(`[Variable] variableName: ${variableName} is not in cache, resolving...`);
        const result = await resolver(this);
        this.cache[variableName] = result;
        debug(`[Variable] variableName ${variableName} caches result: ${result}`);
        return result;
    }
}

// VariableName is derived from VARIABLE_MAP_BASE keys — no manual union type to maintain.
export type VariableName = keyof typeof Variable.VARIABLE_MAP_BASE;
