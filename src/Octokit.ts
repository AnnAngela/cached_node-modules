import { getInput } from "@actions/core";
import { Octokit } from "@octokit/rest";
import { retry } from "@octokit/plugin-retry";
import { createActionAuth } from "@octokit/auth-action";
import { context } from "@actions/github";

const GITHUB_TOKEN = getInput("githubToken");
process.env.GITHUB_TOKEN = GITHUB_TOKEN;
class OctokitWithRetry extends Octokit.plugin(retry) {
    constructor() {
        super({
            authStrategy: createActionAuth,
        });
    }
    context = context;
}

export default new OctokitWithRetry();
