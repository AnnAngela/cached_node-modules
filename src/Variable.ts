import { debug } from "@actions/core";
import semver from "semver";
import spawnChildProcess from "./spawnChildProcess.js";
import { hashCalc } from "./hashCalc.js";
import octokit from "./Octokit.js";

interface variableMap {
    OS_NAME: string;
    NODE_ARCH: string;
    NODE_VERSION: string;
    NODE_VERSION_MAJOR: string;
    NODE_VERSION_MINOR: string;
    NODE_VERSION_PATCH: string;
    PM_VERSION: string;
    LOCKFILE_GIT_COMMIT_LONG: string;
    LOCKFILE_GIT_COMMIT_SHORT: string;
    LOCKFILE_HASH_SHA2_256: string;
    LOCKFILE_HASH_SHA2_512: string;
    LOCKFILE_HASH_SHA3_256: string;
    LOCKFILE_HASH_SHA3_512: string;
    PACKAGEJSON_GIT_COMMIT_LONG: string;
    PACKAGEJSON_GIT_COMMIT_SHORT: string;
    PACKAGEJSON_HASH_SHA2_256: string;
    PACKAGEJSON_HASH_SHA2_512: string;
    PACKAGEJSON_HASH_SHA3_256: string;
    PACKAGEJSON_HASH_SHA3_512: string;
}

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

type variableFunction = (_input: string) => Promise<string>;

/**
 * Known variable names accepted by {@link Variable.get}.
 * CUSTOM_VARIABLE, PM, LOCKFILE, and PM_VERSION_* are handled directly;
 * all other names must be keys of {@link Variable.VARIABLE_MAP_BASE}.
 */
export type VariableName = keyof variableMap | "CUSTOM_VARIABLE" | "PM" | "LOCKFILE" | "PM_VERSION_MAJOR" | "PM_VERSION_MINOR" | "PM_VERSION_PATCH";

export default class Variable {
    // VARIABLE_MAP_BASE holds all variable resolvers that do NOT depend on
    // the instance's packageManager. PM_VERSION is resolved per-instance
    // in get() so that each Variable instance can target a different package
    // manager without static-state races.
    private static readonly VARIABLE_MAP_BASE: Readonly<Omit<Record<keyof variableMap, variableFunction>, "PM_VERSION">> = {
        OS_NAME: (cwd) => spawnChildProcess("node --eval=\"console.info(process.platform)\"", { cwd }),
        NODE_ARCH: (cwd) => spawnChildProcess("node --eval=\"console.info(process.arch)\"", { cwd }),
        NODE_VERSION: (cwd) => spawnChildProcess("node --version", { cwd }),
        NODE_VERSION_MAJOR: async (cwd) => `${semver.major(await Variable.VARIABLE_MAP_BASE.NODE_VERSION(cwd))}`,
        NODE_VERSION_MINOR: async (cwd) => `${semver.minor(await Variable.VARIABLE_MAP_BASE.NODE_VERSION(cwd))}`,
        NODE_VERSION_PATCH: async (cwd) => `${semver.patch(await Variable.VARIABLE_MAP_BASE.NODE_VERSION(cwd))}`,
        LOCKFILE_GIT_COMMIT_LONG: fetchFileGitCommitLong,
        LOCKFILE_GIT_COMMIT_SHORT: async (filePath) => (await fetchFileGitCommitLong(filePath)).slice(0, 7),
        PACKAGEJSON_GIT_COMMIT_LONG: fetchFileGitCommitLong,
        PACKAGEJSON_GIT_COMMIT_SHORT: async (filePath) => (await fetchFileGitCommitLong(filePath)).slice(0, 7),
        LOCKFILE_HASH_SHA2_256: (filePath) => hashCalc(filePath, "SHA2_256"),
        LOCKFILE_HASH_SHA2_512: (filePath) => hashCalc(filePath, "SHA2_512"),
        LOCKFILE_HASH_SHA3_256: (filePath) => hashCalc(filePath, "SHA3_256"),
        LOCKFILE_HASH_SHA3_512: (filePath) => hashCalc(filePath, "SHA3_512"),
        PACKAGEJSON_HASH_SHA2_256: (filePath) => hashCalc(filePath, "SHA2_256"),
        PACKAGEJSON_HASH_SHA2_512: (filePath) => hashCalc(filePath, "SHA2_512"),
        PACKAGEJSON_HASH_SHA3_256: (filePath) => hashCalc(filePath, "SHA3_256"),
        PACKAGEJSON_HASH_SHA3_512: (filePath) => hashCalc(filePath, "SHA3_512"),
    };
    private readonly cache: Partial<variableMap> = {};
    private readonly packageManager: string;
    constructor(
        private readonly cwd: string,
        private readonly lockfilePath: string,
        private readonly packageJsonPath: string,
        private readonly customVariable: string,
        packageManager: string,
    ) {
        this.packageManager = packageManager;
    }
    getCache() {
        return Object.freeze(this.cache);
    }
    private async runFunctionBasedOnVariableName(variableName: keyof variableMap, fn: variableFunction): Promise<string> {
        // All HASH and GIT_COMMIT variables start with either LOCKFILE or PACKAGEJSON.
        // No other prefixes exist in the current variableMap.
        const prefix = variableName.split("_").shift();
        if (prefix === "LOCKFILE") {
            return await fn(this.lockfilePath);
        }
        // PACKAGEJSON — covers PACKAGEJSON_HASH_* and PACKAGEJSON_GIT_COMMIT_*
        return await fn(this.packageJsonPath);
    }
    // Mapping from package manager to lockfile base name (without extension).
    // Used by the {LOCKFILE} magic variable.
    private static readonly PM_LOCKFILE_MAP: Record<string, string> = {
        npm: "package-lock",
        pnpm: "pnpm-lock",
        yarn: "yarn",
    };
    /**
     * Type guard: checks whether `name` is a recognised variable name
     * that can be passed to {@link Variable.get}.
     */
    static isVariableName = (name: string): name is VariableName => name === "CUSTOM_VARIABLE"
        || name === "PM"
        || name === "LOCKFILE"
        || name.startsWith("PM_VERSION_")
        || Reflect.has(Variable.VARIABLE_MAP_BASE, name);
    async get(variableName: VariableName): Promise<string> {
        debug(`[Variable] variableName: ${variableName}`);
        if (variableName === "CUSTOM_VARIABLE") {
            debug(`[Variable] variableName is "CUSTOM_VARIABLE", returning customVariable: ${this.customVariable}`);
            return this.customVariable;
        }
        if (variableName === "PM") {
            debug(`[Variable] variableName is "PM", returning packageManager: ${this.packageManager}`);
            return this.packageManager;
        }
        if (variableName === "LOCKFILE") {
            const lockfileName = Variable.PM_LOCKFILE_MAP[this.packageManager] ?? "package-lock";
            debug(`[Variable] variableName is "LOCKFILE", returning lockfileName: ${lockfileName}`);
            return lockfileName;
        }
        // PM_VERSION: the raw version string of the package manager.
        // Resolved per-instance using the instance's packageManager, so
        // each Variable can target a different package manager.
        if (variableName === "PM_VERSION") {
            const cached = this.cache[variableName];
            if (typeof cached === "string") {
                debug(`[Variable] variableName: ${variableName} is in cache, returning cached value: ${cached}`);
                return cached;
            }
            const result = await spawnChildProcess(`${this.packageManager} --version`, { cwd: this.cwd });
            this.cache[variableName] = result;
            debug(`[Variable] variableName ${variableName} caches result: ${result}`);
            return result;
        }
        // PM_VERSION_MAJOR/MINOR/PATCH are derived from PM_VERSION via semver.
        // They go through `get("PM_VERSION")` so that the cache on PM_VERSION
        // is respected — this avoids redundant spawnChildProcess calls.
        if (variableName === "PM_VERSION_MAJOR" || variableName === "PM_VERSION_MINOR" || variableName === "PM_VERSION_PATCH") {
            const cached = this.cache[variableName as keyof variableMap];
            if (typeof cached === "string") {
                debug(`[Variable] variableName: ${variableName} is in cache, returning cached value: ${cached}`);
                return cached;
            }
            const version = await this.get("PM_VERSION");
            const parsed = semver.parse(version);
            if (!parsed) {
                throw new Error(`Failed to parse "${this.packageManager}" version "${version}" as semver.`);
            }
            // Direct comparison avoids redundant string parsing
            // (variableName is already narrowed to one of 3 values by the if above).
            let value: string;
            if (variableName === "PM_VERSION_MAJOR") {
                value = `${parsed.major}`;
            } else if (variableName === "PM_VERSION_MINOR") {
                value = `${parsed.minor}`;
            } else {
                value = `${parsed.patch}`;
            }
            this.cache[variableName as keyof variableMap] = value;
            debug(`[Variable] variableName ${variableName} derived from PM_VERSION: ${value}`);
            return value;
        }
        if (!Reflect.has(Variable.VARIABLE_MAP_BASE, variableName)) {
            throw new Error(`Variable "${variableName}" is not defined.`);
        }
        const fn = Variable.VARIABLE_MAP_BASE[variableName];
        const cachedValue = this.cache[variableName];
        if (typeof cachedValue === "string") {
            debug(`[Variable] variableName: ${variableName} is in cache, returning cached value: ${cachedValue}`);
            return cachedValue;
        }
        debug(`[Variable] variableName: ${variableName} is not in cache...`);
        let result: string;
        if (variableName.includes("_HASH_")) {
            debug(`[Variable] variableName: ${variableName} is a hash variable, calculating hash...`);
            result = await this.runFunctionBasedOnVariableName(variableName, fn);
        } else if (variableName.includes("_GIT_COMMIT_")) {
            debug(`[Variable] variableName: ${variableName} is a git-commit variable, getting git-commit...`);
            result = await this.runFunctionBasedOnVariableName(variableName, fn);
        } else {
            debug(`[Variable] variableName: ${variableName} is not a special variable, running command...`);
            result = await fn(this.cwd);
        }
        this.cache[variableName] = result;
        debug(`[Variable] variableName ${variableName} caches result: ${result}`);
        return result;
    }
}
