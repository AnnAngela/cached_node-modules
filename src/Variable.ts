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
export default class Variable {
    static readonly VARIABLE_MAP: Readonly<Record<keyof variableMap, variableFunction>> = {
        OS_NAME: (cwd) => spawnChildProcess("node --eval=\"console.info(process.platform)\"", { cwd }),
        NODE_ARCH: (cwd) => spawnChildProcess("node --eval=\"console.info(process.arch)\"", { cwd }),
        NODE_VERSION: (cwd) => spawnChildProcess("node --version", { cwd }),
        NODE_VERSION_MAJOR: async (cwd) => `${semver.major(await Variable.VARIABLE_MAP.NODE_VERSION(cwd))}`,
        NODE_VERSION_MINOR: async (cwd) => `${semver.minor(await Variable.VARIABLE_MAP.NODE_VERSION(cwd))}`,
        NODE_VERSION_PATCH: async (cwd) => `${semver.patch(await Variable.VARIABLE_MAP.NODE_VERSION(cwd))}`,
        // PM_VERSION: the raw version string of the package manager.
        // The packageManager to use is read from the static property set by the constructor.
        PM_VERSION: function (cwd) { return spawnChildProcess(`${Variable.packageManager} --version`, { cwd }) },
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
    private static packageManager: string = "npm";
    constructor(
        private readonly cwd: string,
        private readonly lockfilePath: string,
        private readonly packageJsonPath: string,
        private readonly customVariable: string,
        packageManager: string,
    ) {
        Variable.packageManager = packageManager;
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
    async get(variableName: keyof variableMap | "CUSTOM_VARIABLE" | "PM" | "PM_VERSION_MAJOR" | "PM_VERSION_MINOR" | "PM_VERSION_PATCH"): Promise<string> {
        debug(`[Variable] variableName: ${variableName}`);
        if (variableName === "CUSTOM_VARIABLE") {
            debug(`[Variable] variableName is "CUSTOM_VARIABLE", returning customVariable: ${this.customVariable}`);
            return this.customVariable;
        }
        if (variableName === "PM") {
            debug(`[Variable] variableName is "PM", returning packageManager: ${Variable.packageManager}`);
            return Variable.packageManager;
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
            const suffix = (variableName as string).split("_").pop()!;
            const parsed = semver.parse(version);
            if (!parsed) {
                throw new Error(`Failed to parse "${Variable.packageManager}" version "${version}" as semver.`);
            }
            let value: string;
            if (suffix === "MAJOR") {
                value = `${parsed.major}`;
            } else if (suffix === "MINOR") {
                value = `${parsed.minor}`;
            } else {
                value = `${parsed.patch}`;
            }
            this.cache[variableName as keyof variableMap] = value;
            debug(`[Variable] variableName ${variableName} derived from PM_VERSION: ${value}`);
            return value;
        }
        if (!Reflect.has(Variable.VARIABLE_MAP, variableName)) {
            throw new Error(`Variable "${variableName}" is not defined.`);
        }
        const fn = Variable.VARIABLE_MAP[variableName];
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
