import fs from "node:fs/promises";
import path from "node:path";
import { Octokit } from "@octokit/rest";
import { retry } from "@octokit/plugin-retry";
import mkdtmp from "./modules/mkdtmp.js";
import console from "./modules/console.js";

// 经 GitHub git database API 创建「含 dist 构建产物」的 commit、annotated tag、GitHub Release，
// 以及滚动 major tag。所有对象以 github-actions[bot] 身份经 GITHUB_TOKEN 认证的请求创建，
// 因此 commit/tag 自动获得 Verified 徽章（GitHub 对 bot 签名的验证规则）。
//
// 为什么不用 git commit + git push：git push 协议的推送不经 GITHUB_TOKEN 认证，
// 产生的 commit/tag 不会 Verified；而经 REST API 创建的对象，只要 author/committer 为 bot
// 标准身份且无自定义签名信息，GitHub 即标记 Verified。
//
// 环境变量（由 workflow 通过 env 注入，避免 workflow injection）：
//   RELEASE_VERSION  目标版本号，如 6.0.1（无 v 前缀）
//   GITHUB_REPOSITORY  owner/repo，由 GitHub Actions 自动注入
//   GITHUB_TOKEN  认证 token

const BOT_NAME = "github-actions[bot]";
const BOT_EMAIL = "41898282+github-actions[bot]@users.noreply.github.com";

const version = process.env.RELEASE_VERSION;
// 严格校验版本号格式，防止注入（version 来自 package.json，但仍校验）。
// eslint-disable-next-line security/detect-unsafe-regex -- 版本号正则无 ReDoS 风险（无嵌套量词）
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
    throw new Error(`Invalid RELEASE_VERSION: ${version}`);
}
const repo = process.env.GITHUB_REPOSITORY;
if (!repo) {
    throw new Error("GITHUB_REPOSITORY is not set");
}
const token = process.env.GITHUB_TOKEN;
if (!token) {
    throw new Error("GITHUB_TOKEN is not set");
}
const [owner, repoName] = repo.split("/");
const tag = `v${version}`;
const majorTag = `v${version.split(".")[0]}`;
console.info(`Releasing ${tag} (major rolling tag: ${majorTag})`);

// 带 retry 插件的 Octokit——GitHub API 偶发限流/5xx 时自动重试。
const octokit = new (Octokit.plugin(retry))({
    auth: token,
    retry: { retries: 3 },
});

// dist 产物文件——esbuild 构建输出，需纳入 tag commit 以便 Action 用户 checkout 后可用。
const distFiles = ["dist/index.js", "dist/post.js", "dist/package.json"];

const tmpDir = await mkdtmp();

// 1. 以触发本次 workflow 的 commit（GITHUB_SHA）作为 parent/base tree。
// 不用 getRef(heads/master) 实时取 master HEAD——publish job 运行期间 master 可能被新 push 更新
// （如连续合并多个 Release PR），会导致 API 侧基于新 SHA 建 commit/tree，而本地构建的 dist
// 对应旧 checkout SHA，最终 tag 指向内容与产物不一致。GITHUB_SHA 由 GitHub Actions 注入，
// 等于 checkout 的 ref，与构建产物保证一致。
const headSha = process.env.GITHUB_SHA;
if (!headSha) {
    throw new Error("GITHUB_SHA is not set");
}
console.info("Fetching base commit...");
const headCommitObj = await octokit.git.getCommit({ owner, repo: repoName, commit_sha: headSha }); // eslint-disable-line camelcase -- octokit API 参数为 snake_case
const baseTreeSha = headCommitObj.data.tree.sha;
const committerDate = headCommitObj.data.committer?.date;
console.info(`base commit: ${headSha}, base tree: ${baseTreeSha}`);

// 2. 为每个 dist 文件单独创建 blob（base64 编码），再在 tree entry 中以 sha 引用。
// 不能用 createTree 内联 content：① createTree 的 content 字段按原始文本存储、不解码 base64；
// ② dist/index.js 约 1.5MB，远超 createTree 内联 content 的体积限制，内联会致 API 调用失败。
// createBlob 专门支持 encoding: base64 且无此体积限制。
console.info("Creating blobs for dist files...");
const treeEntries = [];
for (const filePath of distFiles) {
    const content = await fs.readFile(filePath);
    const blob = await octokit.git.createBlob({
        owner,
        repo: repoName,
        content: content.toString("base64"),
        encoding: "base64",
    });
    treeEntries.push({ path: filePath, mode: "100644", type: "blob", sha: blob.data.sha });
    console.info(`  blob for ${filePath}: ${blob.data.sha}`);
}
console.info("Creating tree with dist files...");
const newTree = await octokit.git.createTree({
    owner,
    repo: repoName,
    base_tree: baseTreeSha, // eslint-disable-line camelcase -- octokit API 参数为 snake_case
    tree: treeEntries,
});
console.info(`new tree: ${newTree.data.sha}`);

// 3. 创建 commit，parent 指向触发本次 workflow 的 commit（GITHUB_SHA），author/committer 为 bot（自动 Verified）。
// message 用 "release:" 非 conventional feat 类型——此 commit 会进 master 历史（见 step 9），
// 即便被 release-please 扫到，"release:" 不触发版本 bump，避免误判为新 feature。
console.info("Creating commit with dist...");
const newCommit = await octokit.git.createCommit({
    owner,
    repo: repoName,
    message: `release: package ${tag}`,
    tree: newTree.data.sha,
    parents: [headSha],
    author: { name: BOT_NAME, email: BOT_EMAIL, date: committerDate },
    committer: { name: BOT_NAME, email: BOT_EMAIL },
});
console.info(`new commit: ${newCommit.data.sha}`);

// 4. 创建 annotated tag object 指向该 commit（tagger 为 bot，自动 Verified）。
console.info(`Creating annotated tag ${tag}...`);
const tagObject = await octokit.git.createTag({
    owner,
    repo: repoName,
    tag,
    message: `release: ${tag}`,
    object: newCommit.data.sha,
    type: "commit",
    tagger: { name: BOT_NAME, email: BOT_EMAIL },
});
console.info(`tag object: ${tagObject.data.sha}`);

// 5. 建 tag ref 指向 tag object SHA。
console.info(`Creating ref refs/tags/${tag}...`);
try {
    await octokit.git.createRef({
        owner,
        repo: repoName,
        ref: `refs/tags/${tag}`,
        sha: tagObject.data.sha,
    });
} catch (e) {
    // 重跑场景：精确版本 tag ref 已存在，不应覆盖，仅幂等跳过，使 workflow 可重跑。
    if (e.status !== 422) {
        throw e;
    }
    console.info(`  refs/tags/${tag} already exists, skipping`);
}

// 6. 从 CHANGELOG.md 提取本次版本的 release notes 段落。
console.info("Extracting release notes from CHANGELOG.md...");
const changelog = await fs.readFile("CHANGELOG.md", "utf8").catch(() => "");
let notes = "";
if (changelog) {
    // release-please 的 CHANGELOG 每个版本段落以 <a name="vx.y.z"></a> 或 ## [vx.y.z] 开头。
    // 取从本版本标题到下一个版本标题（或文件末）之间的内容。
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // eslint-disable-next-line security/detect-non-literal-regexp -- escaped 由固定 tag 转义而来，无注入风险
    const versionHeaderRe = new RegExp(`(^|\\n)#{1,3}\\s*(\\[?)${escaped}(\\]?)|<a name="${escaped}"></a>`);
    const lines = changelog.split("\n");
    let start = -1;
    let end = lines.length;
    for (let i = 0; i < lines.length; i++) {
        if (versionHeaderRe.test(lines[i])) {
            if (start === -1) {
                start = i;
            } else {
                end = i;
                break;
            }
        }
    }
    if (start !== -1) {
        notes = lines.slice(start, end).join("\n").trim();
    }
}
if (!notes) {
    notes = `release: ${tag}`;
}
const notesFile = path.join(tmpDir, "notes.md");
await fs.writeFile(notesFile, notes);

// 7. 创建 GitHub Release（body 取自 CHANGELOG 段落，target 指向含 dist 的 commit）。
console.info(`Creating GitHub Release for ${tag}...`);
try {
    await octokit.repos.createRelease({
        owner,
        repo: repoName,
        tag_name: tag, // eslint-disable-line camelcase -- octokit API 参数为 snake_case
        name: tag,
        body: notes,
        target_commitish: newCommit.data.sha, // eslint-disable-line camelcase -- octokit API 参数为 snake_case
    });
} catch (e) {
    // 重跑场景：该 tag 的 release 已存在，幂等跳过（不覆盖已有 body），使 workflow 可重跑。
    if (e.status !== 422) {
        throw e;
    }
    console.info(`  release for ${tag} already exists, skipping`);
}

// 8. 移动滚动 major tag 指向新 commit（force update ref）。
// 滚动 tag 每次重指，无法稳定 Verified——可接受，用户锁定版本应优先用精确 tag（如 v6.0.1）。
console.info(`Moving rolling major tag ${majorTag} -> ${newCommit.data.sha}...`);
try {
    await octokit.git.updateRef({
        owner,
        repo: repoName,
        ref: `tags/${majorTag}`,
        sha: newCommit.data.sha,
        force: true,
    });
    console.info(`  updated existing ${majorTag}`);
} catch (e) {
    // 仅当 major tag 确实不存在（404）时才创建（轻量 tag，指向 commit，非 annotated）。
    // 其他错误（权限/限流等）重新抛出，避免掩盖真实故障、误判为"不存在"去 createRef。
    if (e.status !== 404) {
        throw e;
    }
    console.info(`  ${majorTag} not found, creating...`);
    await octokit.git.createRef({
        owner,
        repo: repoName,
        ref: `refs/tags/${majorTag}`,
        sha: newCommit.data.sha,
    });
}

// 9. 把 dist commit 接入 master 分支历史（fast-forward master 到 dist commit）。
// 必要性：release-please 依赖"沿 master 历史回溯到上次版本 tag"判定 last-release。
// 若 dist commit 仅被 tag 引用而不在 master 分支上（detached），release-please 无法沿历史
// 定位它，会退化为从仓库起点扫描全部 commit，污染 changelog（v6.0.0 即因此触发）。
// 把 master 推进到 dist commit 后，版本 tag 指向的 commit 即在 master 线性链上，可正常回溯。
// force: false 仅允许 fast-forward——dist commit 的 parent 即 checkout 时的 GITHUB_SHA（master HEAD），
// 故可 fast-forward；若期间 master 被新 push 导致非 fast-forward，安全失败比错误覆盖更可取。
console.info(`Fast-forwarding master -> ${newCommit.data.sha}...`);
await octokit.git.updateRef({
    owner,
    repo: repoName,
    ref: "heads/master",
    sha: newCommit.data.sha,
});
console.info(`  master updated to ${newCommit.data.sha}`);

console.info(`Release ${tag} completed successfully.`);
