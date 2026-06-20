import fs from "node:fs";
import path from "node:path";
import console, { originalConsole } from "../modules/console.js";
import git from "../modules/git.js";
originalConsole.info("=".repeat(120));
console.info("Initialization done.");

const packageLockFile = "package-lock.json";

console.info("Start to recover", packageLockFile);
// 读取 before.js 写入的指针文件，定位其创建的备份目录（本进程不再创建临时目录）。
const pointerFile = path.join(".cache", "ci-backup.pointer");
const tmpdir = await fs.promises.readFile(pointerFile, "utf8").then((s) => s.trim());
const backupedPackageLockFile = path.join(tmpdir, packageLockFile);
console.info("Start to check backup file:", backupedPackageLockFile);
const backupedPackageLockFileExists = await fs.promises.access(backupedPackageLockFile).then(() => true).catch(() => false);
if (backupedPackageLockFileExists) {
    console.info("Backup file exists, use it to recover.");
    await fs.promises.cp(backupedPackageLockFile, packageLockFile, { force: true, preserveTimestamps: true });
} else {
    console.info("Backup file unexists, use `git` to recover.");
    await git.checkout(packageLockFile);
}
// 不在此清理指针文件与临时目录——清理统一由 ci script 的 trap EXIT 兜底，
// 覆盖成功/失败/中断三条路径（npm ci 失败时本进程不会执行，仅 trap 能清）。
console.info("Done.");
