import type { ExecException } from "node:child_process";
import path from "node:path";
import { debug } from "@actions/core";
import { major, minor, patch } from "semver";
import spawnChildProcess from "./spawnChildProcess.js";
import { hashCalc, algorithmMap } from "./hashCalc.js";

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
    PACKAGEJSON_GIT_COMMIT_LONG: string
    PACKAGEJSON_GIT_COMMIT_SHORT: string
    PACKAGEJSON_HASH_SHA2_256: string
    PACKAGEJSON_HASH_SHA2_512: string
    PACKAGEJSON_HASH_SHA3_256: string
    PACKAGEJSON_HASH_SHA3_512: string
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
        LOCKFILE_GIT_COMMIT_LONG: "git log --pretty=format:\"%H\" -n 1 {LOCKFILE_PATH_RELATIVE_FROM_CWD}",
        LOCKFILE_GIT_COMMIT_SHORT: "git log --pretty=format:\"%h\" -n 1 {LOCKFILE_PATH_RELATIVE_FROM_CWD}",
        LOCKFILE_HASH_SHA2_256: "::LOCKFILE_HASH_SHA2_256::",
        LOCKFILE_HASH_SHA2_512: "::LOCKFILE_HASH_SHA2_512::",
        LOCKFILE_HASH_SHA3_256: "::LOCKFILE_HASH_SHA3_256::",
        LOCKFILE_HASH_SHA3_512: "::LOCKFILE_HASH_SHA3_512::",
        PACKAGEJSON_GIT_COMMIT_LONG: "git log --pretty=format:\"%H\" -n 1 {PACKAGEJSON_PATH_RELATIVE_FROM_CWD}",
        PACKAGEJSON_GIT_COMMIT_SHORT: "git log --pretty=format:\"%h\" -n 1 {PACKAGEJSON_PATH_RELATIVE_FROM_CWD}",
        PACKAGEJSON_HASH_SHA2_256: "::PACKAGEJSON_HASH_SHA2_256::",
        PACKAGEJSON_HASH_SHA2_512: "::PACKAGEJSON_HASH_SHA2_512::",
        PACKAGEJSON_HASH_SHA3_256: "::PACKAGEJSON_HASH_SHA3_256::",
        PACKAGEJSON_HASH_SHA3_512: "::PACKAGEJSON_HASH_SHA3_512::",
    };
    private readonly cache: Partial<variableMap> = {};
    // eslint-disable-next-line prefer-arrow-functions/prefer-arrow-functions -- False positive
    constructor(
        private readonly cwd: string,
        private readonly lockfilePath: string,
        private readonly lockfileContentPath: string,
        private readonly packageJsonPath: string,
        private readonly customVariable: string,
    ) { }
    getCache() {
        return Object.freeze(this.cache);
    }
    private replaceCommandVariables(command: string): string {
        return command
            .replaceAll("{LOCKFILE_PATH}", this.lockfilePath)
            .replaceAll("{LOCKFILE_PATH_RELATIVE_FROM_CWD}", path.relative(this.cwd, this.lockfilePath))
            .replaceAll("{PACKAGEJSON_PATH}", this.packageJsonPath)
            .replaceAll("{PACKAGEJSON_PATH_RELATIVE_FROM_CWD}", path.relative(this.cwd, this.packageJsonPath));
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
    private async getFromHash(variableName: keyof variableMap): Promise<string> {
        const hashFileFromType = {
            LOCKFILE: this.lockfileContentPath,
            PACKAGEJSON: this.packageJsonPath,
        };
        const fileType = variableName.split("_").shift() as keyof typeof hashFileFromType;
        const algorithm = variableName.split("_HASH_").pop() as keyof typeof algorithmMap;
        return await hashCalc(hashFileFromType[fileType], algorithm);
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
        if (variableName.includes("_HASH_")) {
            debug(`[Variable] variableName: ${variableName} is a hash variable, calculating hash...`);
            result = await this.getFromHash(variableName);
        } else if (variableName.includes("_VERSION_")) {
            debug(`[Variable] variableName: ${variableName} is a version variable, getting version...`);
            result = await this.getFromVersion(variableName);
        } else if (variableName.includes("_GIT_COMMIT_")) {
            debug(`[Variable] variableName: ${variableName} is a git-commit variable, getting git-commit...`);
            try {
                result = await spawnChildProcess(this.replaceCommandVariables(command), { cwd: this.cwd });
            } catch (e) {
                const error = e as ExecException;
                if (error.message.includes("not a git repository")) {
                    const newVariableName = variableName.replace(/_GIT_COMMIT_.+/, "_HASH_SHA3_512") as keyof variableMap;
                    debug(`[Variable] variableName: ${variableName} is a git-commit variable, but the target file is not in a git repository, use new \`${newVariableName}\`.`);
                    result = await this.get(newVariableName);
                } else {
                    throw error;
                }
            }
        } else {
            debug(`[Variable] variableName: ${variableName} is not a special variable, running command...`);
            result = await spawnChildProcess(this.replaceCommandVariables(command), { cwd: this.cwd });
        }
        this.cache[variableName] = result;
        debug(`[Variable] variableName ${variableName} caches result: ${result}`);
        return result;
    }
}
