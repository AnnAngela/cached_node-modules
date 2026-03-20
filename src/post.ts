import { getState, warning } from "@actions/core";
import { context } from "@actions/github";
import octokit from "./Octokit.js";

const cacheKey = getState("cacheKey").trim();
const cacheSaved = getState("cacheSaved") === "true";

const cleanup = async () => {
    if (!cacheSaved || !cacheKey) {
        console.info("No cache created by this action run, skip cache deletion.");
        return;
    }

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
};

cleanup().catch((error) => {
    const target = cacheKey ? `cache "${cacheKey}"` : "cache";
    warning(`Failed to delete ${target} in post step: ${error instanceof Error ? error.message : String(error)}`);
});
