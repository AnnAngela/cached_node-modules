import { getState, warning } from "@actions/core";
import { context } from "@actions/github";
import octokit from "./Octokit.js";

const cacheKey = getState("cacheKey");
const cacheSaved = getState("cacheSaved") === "true";

if (!cacheSaved || !cacheKey) {
    console.info("No cache created by this action run, skip cache deletion.");
} else {
    try {
        const {
            repo: { owner, repo },
        } = context;
        await octokit.actions.deleteActionsCacheByKey({
            owner,
            repo,
            key: cacheKey,
            ref: context.ref,
        });
        console.info(`Deleted cache for key "${cacheKey}".`);
    } catch (error) {
        warning(`Failed to delete cache "${cacheKey}" in post step: ${error instanceof Error ? error.message : String(error)}`);
    }
}
