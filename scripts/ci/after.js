import fs from "node:fs";
import path from "node:path";
import console, { originalConsole } from "../modules/console.js";
import git from "../modules/git.js";
originalConsole.info("=".repeat(120));
console.info("Initialization done.");

const packageLockFile = "package-lock.json";

console.info("Start to recover", packageLockFile);
// 读取 before.js 写入的指针文件，定位其创建的备份目录（本进程不再创建临时目录）。
const pointerFile = path.join(".cache", `${process.env.RANDOM_UUID}.pointer`);
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
// 读取完毕，清理指针文件（.cache 本身 gitignore，但避免残留堆积）。
await fs.promises.rm(pointerFile, { force: true });
console.info("Done.");
