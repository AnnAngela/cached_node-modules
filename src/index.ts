import { isFeatureAvailable, restoreCache, saveCache } from "@actions/cache";
import { debug, endGroup, getInput, saveState, setOutput, startGroup, warning } from "@actions/core";
import fs from "node:fs";
import path from "node:path";
import Variable from "./Variable.js";
import spawnChildProcess from "./spawnChildProcess.js";

const trimBrackets = (str: string) => str.replace(/^\{(.*)\}$/, "$1");

if (!isFeatureAvailable()) {
    throw new Error("Cache feature is not available.");
}

console.info("Parsing input...");

const rawPackageManager = getInput("packageManager") || "npm";
// Validate packageManager — must be one of the supported values.
const VALID_PACKAGE_MANAGERS = ["npm", "pnpm", "yarn"] as const;
type SupportedPM = typeof VALID_PACKAGE_MANAGERS[number];
if (!(VALID_PACKAGE_MANAGERS as readonly string[]).includes(rawPackageManager)) {
    throw new Error(`Invalid packageManager "${rawPackageManager}". Must be one of: ${VALID_PACKAGE_MANAGERS.join(", ")}`);
}
// Narrow to the union type — the validation above guarantees this is safe.
const packageManager: SupportedPM = rawPackageManager as SupportedPM;

// Map package manager to default lockfile path and install command.
// Users can override these via explicit lockfilePath / command inputs.
const PM_DEFAULTS: Record<SupportedPM, { lockfilePath: string; command: string }> = {
    npm: { lockfilePath: "package-lock.json", command: "npm ci" },
    pnpm: { lockfilePath: "pnpm-lock.yaml", command: "pnpm install --frozen-lockfile" },
    yarn: { lockfilePath: "yarn.lock", command: "yarn install --frozen-lockfile" },
};

const inputs = {
    cacheKey: getInput("cacheKey"),
    customVariable: getInput("customVariable"),
    command: getInput("command") || PM_DEFAULTS[packageManager].command,
    cwd: getInput("cwd"),
    lockfilePath: getInput("lockfilePath") || PM_DEFAULTS[packageManager].lockfilePath,
    packageJsonPath: getInput("packageJsonPath"),
    networkErrorRetryTime: getInput("networkErrorRetryTime"),
};
inputs.networkErrorRetryTime = /^\d+$/.test(inputs.networkErrorRetryTime) ? inputs.networkErrorRetryTime : "3";

debug(`inputs: ${JSON.stringify(inputs)}`);
debug(`packageManager: ${packageManager}`);

const lockfilePath = path.join(inputs.cwd, inputs.lockfilePath);
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

const variable = new Variable(inputs.cwd, lockfilePath, packageJsonPath, inputs.customVariable, packageManager);

console.info("Replacing variables...");
const variableNames = [...new Set(inputs.cacheKey.match(/\{([A-Z_\d]+)\}/g) ?? [])];
// Sort by length descending to prevent substring collisions:
// e.g. {PM_VERSION_MAJOR} (longer) is replaced before {PM} (shorter),
// so {PM} replacement doesn't corrupt {PM_VERSION_MAJOR}.
variableNames.sort((a, b) => b.length - a.length);
debug(`[replacingVariables] matched variableNames (after removing duplicate variables and sorting): ${JSON.stringify(variableNames)}`);
let cacheKey = inputs.cacheKey;
debug(`[replacingVariables] [start] cacheKey: ${cacheKey}`);
for (const variableName of variableNames) {
    debug(`[replacingVariables] \tRun on variableName: ${variableName}`);
    const trimmedVariableName = trimBrackets(variableName);
    debug(`[replacingVariables] \t\ttrimmedVariableName: ${trimmedVariableName}`);
    if (Variable.isVariableName(trimmedVariableName)) {
        debug(`[replacingVariables] \t\tVariable "${trimmedVariableName}" is in the list.`);
        const variableValue = await variable.get(trimmedVariableName);
        debug(`[replacingVariables] \t\tvariableValue: ${variableValue}`);
        cacheKey = cacheKey.replaceAll(variableName, variableValue);
        debug(`[replacingVariables] \t\tnew cacheKey: ${cacheKey}`);
    } else {
        // Variable name not recognized — the literal will stay in the
        // cacheKey as-is, causing cache-miss forever. Warn the user so
        // they can fix typos or migrate deprecated names.
        warning(
            `Unknown variable "${variableName}" in cacheKey — it will be left as-is. Check for typos or see README for available magic variables.`,
        );
    }
}
cacheKey = cacheKey.trim();
debug(`[replacingVariables] [after] cacheKey: ${cacheKey}`);
console.info("Variables replaced, cacheKey:", cacheKey);
saveState("cacheKey", cacheKey);

startGroup("Try to restore cache...");
const restoreCacheResult = await restoreCache([nodeModulesPath], cacheKey, undefined, {
    timeoutInMs: 1000 * 60 * 5,
    segmentTimeoutInMs: 1000 * 60 * 5,
}, false);
// Drain process.stdout — restoreCache may have internally written
// debug/info messages to stdout that are still buffered. Without this
// drain, process.exit() can cut them off.
await new Promise<void>((resolve) => {
    process.stdout.write("", () => {
        resolve();
    });
});
debug(`restoreCacheResult: ${restoreCacheResult ?? "(undefined)"}`);
endGroup();

if (restoreCacheResult === cacheKey) {
    console.info("Cache exists and restored.");
} else {
    startGroup("Cache does not exist, start to run command...");
    await spawnChildProcess(inputs.command, {
        synchronousStdout: true,
        synchronousStderr: true,
        cwd: inputs.cwd,
        retryTime: +inputs.networkErrorRetryTime,
    });
    endGroup();
    startGroup("Command finished, start to save cache...");
    const saveCacheResult = await saveCache([nodeModulesPath], cacheKey, {
        uploadConcurrency: 8,
    }, false);
    debug(`saveCacheResult: ${saveCacheResult}`);
    saveState("cacheSaved", "true");
    endGroup();
    console.info("Cache saved.");
}

console.info("Setting outputs...");
console.info("\tcacheKey:", cacheKey);
setOutput("cacheKey", cacheKey);
const variables = JSON.stringify(variable.getCache());
console.info("\tvariables:", variables);
setOutput("variables", variables);
const cacheHit = restoreCacheResult === cacheKey;
console.info("\tcache-hit:", cacheHit);
setOutput("cache-hit", cacheHit);
console.info("Outputs set, exit.");
// Drain process.stdout before exiting to ensure all buffered
// ::debug::, ::group:: workflow commands and stdout-piped child
// process output have been flushed to the GitHub Actions runner.
// Without this drain, process.exit() can truncate buffered output
// causing lost workflow logs and intermittent ::set-output failures.
await new Promise<void>((resolve) => {
    process.stdout.write("", () => {
        resolve();
    });
});
