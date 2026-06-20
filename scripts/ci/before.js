import fs from "node:fs";
import path from "node:path";
import console, { originalConsole } from "../modules/console.js";
import jsonModule from "../modules/jsonModule.js";
import mkdtmp from "../modules/mkdtmp.js";
import testLatency from "../modules/testLatency.js";
console.info("Initialization done.");

// 指针文件：before 写入备份目录路径，after.js 跨进程读取定位，
// 使 after 无需（也无法）重新创建同一临时目录。
// 放 .cache/ 下（已 gitignore）；固定文件名——.cache 在 repo 工作区内，
// hosted runner 每次 fresh checkout 不共享，本地不会并发跑两个 ci，无需实例标识。
const pointerFile = path.join(".cache", "ci-backup.pointer");

const packageLockFile = "package-lock.json";

const registries = [
    "https://registry.npmjs.org/",
    "https://mirrors.cloud.tencent.com/npm/",
    "https://registry.npmmirror.com/",
    "https://mirrors.tencentyun.com/npm/",
];
const targetPath = "index.json";
const latency = await testLatency(registries.map((base) => `${base}${targetPath}`));
const targetRegistry = latency.sort(([, a], [, b]) => a - b)[0][0].replace(targetPath, "");
const otherRegistries = registries.filter((registry) => registry !== targetRegistry);
console.info("targetRegistry:", targetRegistry);
console.info("otherRegistries:", otherRegistries);
console.info("Start to backup", packageLockFile);
const tmpdir = await mkdtmp();
// 把本次创建的备份目录路径记入指针文件，供 after.js 读取。
await fs.promises.mkdir(".cache", { recursive: true });
await fs.promises.writeFile(pointerFile, tmpdir, { mode: 0o600 });
const backupedPackageLockFile = path.join(tmpdir, packageLockFile);
await fs.promises.cp(packageLockFile, backupedPackageLockFile, { force: true, preserveTimestamps: true });
console.info("backup:", backupedPackageLockFile);
console.info("Start to read", packageLockFile);
const packageLockFileContent = await jsonModule.readFile(packageLockFile);
console.info("Start to modified resolved path for packages");
const modifiedCount = {};
for (const key of Object.keys(packageLockFileContent.packages)) {
    if (typeof packageLockFileContent.packages[key].resolved === "string") {
        let url = packageLockFileContent.packages[key].resolved;
        for (const registry of otherRegistries) {
            if (url.startsWith(registry)) {
                url = url.replace(registry, targetRegistry);
                if (typeof modifiedCount[registry] !== "number") {
                    modifiedCount[registry] = 0;
                }
                modifiedCount[registry]++;
                break;
            }
        }
        packageLockFileContent.packages[key].resolved = url;
    }
}
console.info("modifiedCount:", modifiedCount);
console.info("Start to write back", packageLockFile);
await jsonModule.writeFile(packageLockFile, packageLockFileContent);
console.info("Done.");
originalConsole.info("=".repeat(120));
