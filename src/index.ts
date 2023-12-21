import { restoreCache, saveCache } from "@actions/cache";
import { getInput, error, setFailed } from "@actions/core";

const inputs = {
    cacheKey: getInput("cacheKey"),
    customVariable: getInput("customVariable"),
    command: getInput("command"),
    cwd: getInput("cwd"),
    lockfilePath: getInput("lockfilePath"),
};
