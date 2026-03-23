import { getState, warning } from "@actions/core";
import octokit from "./Octokit.js";

const cacheKey = getState("cacheKey").trim();
const cacheSaved = getState("cacheSaved") === "true";

if (!cacheSaved || !cacheKey) {
    console.info("No cache created by this action run, skip cache deletion.");
} else {
    try {
        await octokit.actions.deleteActionsCacheByKey({
            ...octokit.context.repo,
            key: cacheKey,
            ref: octokit.context.ref,
        });
        console.info(`Deleted cache for key "${cacheKey}".`);
    } catch (error) {
        warning(`Failed to delete cache "${cacheKey}" in post step: ${error instanceof Error ? error.message : String(error)}`);
    }
}
