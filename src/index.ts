import { restoreCache, saveCache, isFeatureAvailable } from "@actions/cache";
import { getInput, setOutput, debug, startGroup, endGroup } from "@actions/core";
import path from "path";
import fs from "fs";
import timersPromises from "node:timers/promises";
import Variable from "./Variable.js";
import spawnChildProcess from "./spawnChildProcess.js";
import { packageLockHandler } from "./lockfileHandler.js";

const trimBrackets = (str: string) => str.replace(/^\{(.*)\}$/, "$1");

if (!isFeatureAvailable()) {
    throw new Error("Cache feature is not available.");
}

console.info("Parsing input...");
const inputs = {
    cacheKey: getInput("cacheKey"),
    customVariable: getInput("customVariable"),
    command: getInput("command"),
    cwd: getInput("cwd"),
    lockfilePath: getInput("lockfilePath"),
    packageJsonPath: getInput("packageJsonPath"),
};

debug(`inputs: ${JSON.stringify(inputs)}`);

let lockfilePath = path.join(inputs.cwd, inputs.lockfilePath);
const packageJsonPath = path.join(inputs.cwd, inputs.packageJsonPath);
const nodeModulesPath = path.join(inputs.cwd, "node_modules");
console.info("cwd:", inputs.cwd);
console.info("lockfilePath:", lockfilePath);
console.info("packageJsonPath:", packageJsonPath);
console.info("nodeModulesPath:", nodeModulesPath);

try {
    console.info("Testing if the lockfile can be read...");
    await fs.promises.access(lockfilePath, fs.constants.R_OK);
} catch (cause) {
    throw new Error(`Lockfile "${lockfilePath}" does not exist.`, {
        cause,
    });
}
console.info("Lockfile exists and can be read.");
try {
    console.info("Testing if the package.json can be read...");
    await fs.promises.access(packageJsonPath, fs.constants.R_OK);
} catch (cause) {
    throw new Error(`package.json "${packageJsonPath}" does not exist.`, {
        cause,
    });
}

/**
 * We don't care about leaving the trash in tmp folder since the program will only be run on Github Action's runner.
 * But I want to keep the code for future reference.

const needToDelete: string[] = [];
const deleteFiles = () => {
    for (const path of needToDelete) {
        try {
            // eslint-disable-next-line n/no-sync
            fs.rmSync(path, { recursive: true, force: true });
        } catch (err) {
            console.error(`Failed to delete ${path}:`, err);
        }
    }
};
process.on("exit", deleteFiles);
process.on("uncaughtException", (err) => {
    console.error("Uncaught exception", err);
    deleteFiles();
    // eslint-disable-next-line n/no-process-exit
    process.exit(process.exitCode ?? 1);
});
process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled promise rejection", promise, reason);
    deleteFiles();
    // eslint-disable-next-line n/no-process-exit
    process.exit(process.exitCode ?? 1);
});

*/
const lockfileParsedPath = path.parse(lockfilePath);
if (lockfileParsedPath.name === "package-lock") {
    const {
        // tmpdir,
        newLockfilePath,
    } = await packageLockHandler(lockfilePath, lockfileParsedPath);
    lockfilePath = newLockfilePath;
    // needToDelete.push(tmpdir);
}

const variable = new Variable(inputs.cwd, lockfilePath, packageJsonPath, inputs.customVariable);

console.info("Replacing variables...");
const variableNames = [...new Set(inputs.cacheKey.match(/\{([A-Z_\d]+)\}/g))];
debug(`[replacingVariables] matched variableNames (after removing duplicate variables): ${JSON.stringify(variableNames)}`);
let cacheKey = inputs.cacheKey;
debug(`[replacingVariables] [start] cacheKey: ${cacheKey}`);
for (const variableName of variableNames) {
    debug(`[replacingVariables] \tRun on variableName: ${variableName}`);
    const trimmedVariableName = trimBrackets(variableName);
    debug(`[replacingVariables] \t\ttrimmedVariableName: ${trimmedVariableName}`);
    if (trimmedVariableName === "CUSTOM_VARIABLE" || Reflect.has(Variable.VARIABLE_MAP, trimmedVariableName)) {
        debug(`[replacingVariables] \t\tVariable "${trimmedVariableName}" is in the list.`);
        const variableValue = await variable.get(trimmedVariableName as "CUSTOM_VARIABLE" | keyof typeof Variable.VARIABLE_MAP);
        debug(`[replacingVariables] \t\tvariableValue: ${variableValue}`);
        cacheKey = cacheKey.replaceAll(variableName, variableValue);
        debug(`[replacingVariables] \t\tnew cacheKey: ${cacheKey}`);
    }
}
debug(`[replacingVariables] [after] cacheKey: ${cacheKey}`);
console.info("Variables replaced, cacheKey:", cacheKey);

startGroup("Try to restore cache...");
const restoreCacheResult = await restoreCache([nodeModulesPath], cacheKey, undefined, {
    timeoutInMs: 1000 * 60 * 5,
    segmentTimeoutInMs: 1000 * 60 * 5,
}, false);
await timersPromises.setTimeout(100);
debug(`restoreCacheResult: ${restoreCacheResult}`);
endGroup();

if (restoreCacheResult) {
    console.info("Cache exists and restored.");
} else {
    startGroup("Cache does not exist, start to run command...");
    await spawnChildProcess(inputs.command, {
        synchronousStdout: true,
        synchronousStderr: true,
        cwd: inputs.cwd,
    });
    endGroup();
    startGroup("Command finished, start to save cache...");
    const saveCacheResult = await saveCache([nodeModulesPath], cacheKey, {
        uploadConcurrency: 8,
    }, false);
    debug(`saveCacheResult: ${saveCacheResult}`);
    endGroup();
    console.info("Cache saved.");
}

console.info("Setting outputs...");
console.info("\tcacheKey:", cacheKey);
setOutput("cacheKey", cacheKey);
const variables = JSON.stringify(variable.getCache());
console.info("\tvariables:", variables);
setOutput("variables", variables);
const cacheHit = !!restoreCacheResult;
console.info("\tcache-hit:", cacheHit);
setOutput("cache-hit", cacheHit);
console.info("Outputs set, exit.");
await timersPromises.setTimeout(3000);
// eslint-disable-next-line n/no-process-exit
process.exit(0);
