import { createInterface } from "node:readline";
import { valid, gt, major } from "semver";
import execCommand from "./modules/spawnChildProcess.js";

console.info("Current package:", process.env.npm_package_name);

const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
});
const oldTag = process.env.npm_package_version;
console.log(`Current tag: ${oldTag}`);

let tag = valid(await new Promise((res) => {
    rl.question("Enter a tag: ", (tag) => {
        rl.close();
        res(tag);
    });
}));
if (!tag) {
    throw new Error("Invalid tag");
}
if (!tag.startsWith("v")) {
    tag = `v${tag}`;
}
if (!gt(tag, oldTag)) {
    throw new Error(`New tag (${tag}) must be greater than old tag (${oldTag})`);
}
const tagList = (await execCommand("git tag -l")).split("\n");
if (tagList.includes(tag)) {
    throw new Error(`Tag ${tag} already exists`);
}

console.log(`tag: ${tag}`);

console.log("Bump the package version");
await execCommand(`npm version ${tag.replace(/^v/, "")} --no-git-tag-version`, { synchronousStderr: true, synchronousStdout: true });
await execCommand("git add package-lock.json package.json", { synchronousStderr: true, synchronousStdout: true });
await execCommand(`git commit -S -m "release: ${tag}" -- package-lock.json package.json`, { synchronousStderr: true, synchronousStdout: true });
await execCommand(`git tag -s -m "release: ${tag}" ${tag}`, { synchronousStderr: true, synchronousStdout: true });
await execCommand(`git tag -f -s -m "release: ${tag}" v${major(tag)}`, { synchronousStderr: true, synchronousStdout: true });

console.log("Pushing...");
await execCommand("git push --follow-tags", { synchronousStderr: true, synchronousStdout: true });

const draftReleaseURL = new URL(JSON.parse(await execCommand("npm pkg get homepage")));
draftReleaseURL.hash = "";
draftReleaseURL.pathname += "/releases/new";
console.log("Draft release URL:", draftReleaseURL.toString());
console.log("Release title:", `${tag}`);
await execCommand(`git log --reverse --pretty=format:"* %s (%h)" v${oldTag}...${tag}`).then((changelog) => {
    console.log("-".repeat(73));
    console.log("Example changelog:");
    console.info(changelog);
    console.info("");
}).catch(() => void 0);
console.log("-".repeat(73));
