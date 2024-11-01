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
    NPM_VERSION: string;
    NPM_VERSION_MAJOR: string;
    NPM_VERSION_MINOR: string;
    NPM_VERSION_PATCH: string;
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
    const commits = await octokit.repos.listCommits({
        ...octokit.context.repo,
        path: filePath,
        per_page: 1,
    });
    const [{ sha }] = commits.data;
    debug(`[fetchFileGitCommitLong] Fetched git commit long of ${filePath}: ${sha}`);
    return sha;
};

type variableFunction = (filePath: string) => Promise<string>;
export default class Variable {
    static readonly VARIABLE_MAP: Readonly<Record<keyof variableMap, variableFunction>> = {
        OS_NAME: (cwd) => spawnChildProcess("node --eval=\"console.info(process.platform)\"", { cwd }),
        NODE_ARCH: (cwd) => spawnChildProcess("node --eval=\"console.info(process.arch)\"", { cwd }),
        NODE_VERSION: (cwd) => spawnChildProcess("node --version", { cwd }),
        NODE_VERSION_MAJOR: async (cwd) => `${semver.major(await Variable.VARIABLE_MAP.NODE_VERSION(cwd))}`,
        NODE_VERSION_MINOR: async (cwd) => `${semver.minor(await Variable.VARIABLE_MAP.NODE_VERSION(cwd))}`,
        NODE_VERSION_PATCH: async (cwd) => `${semver.patch(await Variable.VARIABLE_MAP.NODE_VERSION(cwd))}`,
        NPM_VERSION: (cwd) => spawnChildProcess("npm --version", { cwd }),
        NPM_VERSION_MAJOR: async (cwd) => `${semver.major(await Variable.VARIABLE_MAP.NPM_VERSION(cwd))}`,
        NPM_VERSION_MINOR: async (cwd) => `${semver.minor(await Variable.VARIABLE_MAP.NPM_VERSION(cwd))}`,
        NPM_VERSION_PATCH: async (cwd) => `${semver.patch(await Variable.VARIABLE_MAP.NPM_VERSION(cwd))}`,
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
    constructor(
        private readonly cwd: string,
        private readonly lockfilePath: string,
        private readonly packageJsonPath: string,
        private readonly customVariable: string,
    ) { }
    getCache() {
        return Object.freeze(this.cache);
    }
    private async runFunctionBasedOnVariableName(variableName: keyof variableMap, fn: variableFunction): Promise<string> {
        switch (variableName.split("_").shift()) {
            case "LOCKFILE":
                return await fn(this.lockfilePath);
            case "PACKAGEJSON":
                return await fn(this.packageJsonPath);
            default:
                throw new Error(`Variable "${variableName}" is not defined.`);
        }
    }
    async get(variableName: keyof variableMap | "CUSTOM_VARIABLE"): Promise<string> {
        debug(`[Variable] variableName: ${variableName}`);
        if (variableName === "CUSTOM_VARIABLE") {
            debug(`[Variable] variableName is "CUSTOM_VARIABLE", returning customVariable: ${this.customVariable}`);
            return this.customVariable;
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
