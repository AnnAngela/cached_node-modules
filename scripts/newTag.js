// FILEPATH: /data/cached_node-modules/newTag.js
// BEGIN: abpxx6d04wxr
import { createInterface } from "node:readline";
import fs from "node:fs";
import { valid, major, gt } from "semver";
import execCommand from "./spawnChildProcess.js";

const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
});
/**
 * @type { import("../package.json") }
 */
const packageConfig = JSON.parse(await fs.promises.readFile("package.json", { encoding: "utf-8" }));
const oldTag = packageConfig.version;
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

const tagMajor = major(tag);
console.log(`tag: ${tag}`);
console.log(`tagMajor: ${tagMajor}`);

packageConfig.version = tag.replace(/^v/, "");
console.log("Updating package.json with new version...");
await fs.promises.writeFile("package.json", JSON.stringify(packageConfig, null, 4), { encoding: "utf-8" });

console.log("Committing changes...");
await execCommand("git add package.json", { synchronousStderr: true, synchronousStdout: true });
await execCommand(`git commit -S -a -m ${tag}`, { synchronousStderr: true, synchronousStdout: true });

console.log("Tagging...");
await execCommand(`git tag -s ${tag} -m ${tag}`, { synchronousStderr: true, synchronousStdout: true });
await execCommand(`git tag -f ${tagMajor} ${tag}`, { synchronousStderr: true, synchronousStdout: true });

console.log("Pushing...");
await execCommand("git push", { synchronousStderr: true, synchronousStdout: true });
await execCommand("git push -f --tags", { synchronousStderr: true, synchronousStdout: true });
