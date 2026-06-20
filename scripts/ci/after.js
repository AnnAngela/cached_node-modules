import fs from "node:fs";
import path from "node:path";
import console, { originalConsole } from "../modules/console.js";
originalConsole.info("=".repeat(120));
console.info("Initialization done.");

const packageLockFile = "package-lock.json";

console.info("Start to recover", packageLockFile);
// 读取 before.js 写入的指针文件，定位其创建的备份目录（本进程不再创建临时目录）。
// after.js 必须仅依赖 node: 内置模块与 scripts 内部模块——ci script 开头会 rm -rdf
// node_modules，失败路径下 npm 安装残缺，任何外部包（如 simple-git）都无法加载。
const pointerFile = path.join(".cache", "ci-backup.pointer");
const tmpdir = await fs.promises.readFile(pointerFile, "utf8").then((s) => s.trim()).catch(() => null);
if (!tmpdir) {
    // 指针文件缺失（极端情况：before 未成功写出指针），无法定位备份，仅记录警告。
    // 不再降级用 git 恢复：保持 after.js 零外部依赖，确保失败路径可加载。
    console.warn("Pointer file unexists, cannot recover", packageLockFile, "from backup.");
    console.info("Done.");
} else {
    const backupedPackageLockFile = path.join(tmpdir, packageLockFile);
    console.info("Start to check backup file:", backupedPackageLockFile);
    const backupedPackageLockFileExists = await fs.promises.access(backupedPackageLockFile).then(() => true).catch(() => false);
    try {
        if (backupedPackageLockFileExists) {
            console.info("Backup file exists, use it to recover.");
            await fs.promises.cp(backupedPackageLockFile, packageLockFile, { force: true, preserveTimestamps: true });
        } else {
            // 备份文件缺失，无法恢复，仅记录警告（不降级 git）。
            console.warn("Backup file unexists, cannot recover", packageLockFile, "from backup.");
        }
    } finally {
        // 读后清理：删除备份目录与指针文件，避免同机反复跑时残留堆积。
        // 用 force 容忍"不存在"竞态；无论恢复成功与否都清理。
        await fs.promises.rm(tmpdir, { recursive: true, force: true });
        await fs.promises.rm(pointerFile, { force: true });
    }
    console.info("Done.");
}
