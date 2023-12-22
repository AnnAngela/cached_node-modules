import spawnChildProcess from "./spawnChildProcess.js";
import { hashCalc, algorithmMap } from "./hashCalc.js";
import type { ExecException } from "node:child_process";
import { debug } from "@actions/core";
import { major, minor, patch } from "semver";

interface variableMap {
    OS_NAME: string
    NODE_ARCH: string
    NODE_VERSION: string
    NODE_VERSION_MAJOR: string
    NODE_VERSION_MINOR: string
    NODE_VERSION_PATCH: string
    NPM_VERSION: string
    NPM_VERSION_MAJOR: string
    NPM_VERSION_MINOR: string
    NPM_VERSION_PATCH: string
    LOCKFILE_GIT_COMMIT_LONG: string
    LOCKFILE_GIT_COMMIT_SHORT: string
    LOCKFILE_HASH_SHA2_256: string
    LOCKFILE_HASH_SHA2_512: string
    LOCKFILE_HASH_SHA3_256: string
    LOCKFILE_HASH_SHA3_512: string
}
export default class Variable {
    static readonly VARIABLE_MAP: Readonly<variableMap> = {
        OS_NAME: "node --eval=\"console.info(process.platform)\"",
        NODE_ARCH: "node --eval=\"console.info(process.arch)\"",
        NODE_VERSION: "node --version",
        NODE_VERSION_MAJOR: "::NODE_VERSION_MAJOR::",
        NODE_VERSION_MINOR: "::NODE_VERSION_MINOR::",
        NODE_VERSION_PATCH: "::NODE_VERSION_PATCH::",
        NPM_VERSION: "npm --version",
        NPM_VERSION_MAJOR: "::NPM_VERSION_MAJOR::",
        NPM_VERSION_MINOR: "::NPM_VERSION_MINOR::",
        NPM_VERSION_PATCH: "::NPM_VERSION_PATCH::",
        LOCKFILE_GIT_COMMIT_LONG: "git log --pretty=format:\"%H\" -n 1 {LOCKFILE_PATH}",
        LOCKFILE_GIT_COMMIT_SHORT: "git log --pretty=format:\"%h\" -n 1 {LOCKFILE_PATH}",
        LOCKFILE_HASH_SHA2_256: "::LOCKFILE_HASH_SHA2_256::",
        LOCKFILE_HASH_SHA2_512: "::LOCKFILE_HASH_SHA2_512::",
        LOCKFILE_HASH_SHA3_256: "::LOCKFILE_HASH_SHA3_256::",
        LOCKFILE_HASH_SHA3_512: "::LOCKFILE_HASH_SHA3_512::",
    };
    private cache: Partial<variableMap> = {};
    // eslint-disable-next-line prefer-arrow-functions/prefer-arrow-functions
    constructor(
        private readonly lockfilePath: string,
        private readonly customVariable: string,
    ) { }
    getCache() {
        return Object.freeze(this.cache);
    }
    private async getFromVersion(variableName: keyof variableMap): Promise<string> {
        const variant = variableName.split("_").pop() as "MAJOR" | "MINOR" | "PATCH";
        const newVariableName = variableName.replace(`_VERSION_${variant}`, "_VERSION") as keyof variableMap;
        debug(`[Variable] variableName: ${variableName} is a ${variant} version variant of ${newVariableName}, fetching ${newVariableName} first...`);
        const fullVersion = await this.get(newVariableName);
        debug(`[Variable] ${newVariableName}: ${fullVersion}, parsing ${variant} version...`);
        switch (variant) {
            case "MAJOR":
                return `${major(fullVersion)}`;
            case "MINOR":
                return `${minor(fullVersion)}`;
            case "PATCH":
                return `${patch(fullVersion)}`;
        }
    }
    async get(variableName: keyof variableMap | "CUSTOM_VARIABLE"): Promise<string> {
        debug(`[Variable] variableName: ${variableName}`);
        if (variableName === "CUSTOM_VARIABLE") {
            debug(`[Variable] variableName is "CUSTOM_VARIABLE", returning customVariable: ${this.customVariable}`);
            return this.customVariable;
        }
        const command = Variable.VARIABLE_MAP[variableName];
        if (typeof command !== "string") {
            throw new Error(`Variable "${variableName}" is not defined.`);
        }
        const cachedValue = this.cache[variableName];
        if (typeof cachedValue === "string") {
            debug(`[Variable] variableName: ${variableName} is in cache, returning cached value: ${cachedValue}`);
            return cachedValue;
        }
        debug(`[Variable] variableName: ${variableName} is not in cache...`);
        let result: string;
        if (variableName.startsWith("LOCKFILE_HASH_")) {
            debug(`[Variable] variableName: ${variableName} is a hash variable, calculating hash...`);
            let algorithm: keyof typeof algorithmMap;
            switch (variableName) {
                case "LOCKFILE_HASH_SHA2_256":
                    algorithm = "SHA2_256";
                    break;
                case "LOCKFILE_HASH_SHA2_512":
                    algorithm = "SHA2_512";
                    break;
                case "LOCKFILE_HASH_SHA3_256":
                    algorithm = "SHA3_256";
                    break;
                case "LOCKFILE_HASH_SHA3_512":
                    algorithm = "SHA3_512";
                    break;
                default:
                    throw new Error(`Variable "${variableName}" is not defined.`);
            }
            result = await hashCalc(this.lockfilePath, algorithm);
        } else {
            debug(`[Variable] variableName: ${variableName} is not a hash variable, running command...`);
            try {
                if (/_VERSION_[A-Z]+$/.test(variableName)) {
                    result = await this.getFromVersion(variableName);
                } else {
                    result = await spawnChildProcess(command.replaceAll("{LOCKFILE_PATH}", this.lockfilePath));
                }
            } catch (e) {
                const error = e as ExecException;
                if (
                    ["LOCKFILE_GIT_COMMIT_LONG", "LOCKFILE_GIT_COMMIT_SHORT"].includes(variableName)
                    && error.message.includes("not a git repository")
                ) {
                    debug(`[Variable] variableName: ${variableName} is a git variable, but the lockfile is not in a git repository, returning \`LOCKFILE_HASH_SHA3_512\`.`);
                    result = await this.get("LOCKFILE_HASH_SHA3_512");
                } else {
                    throw error;
                }
            }
        }
        this.cache[variableName] = result;
        debug(`[Variable] variableName ${variableName} caches result: ${result}`);
        return result;
    }
}
