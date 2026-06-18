import fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import console from "../modules/console.js";

/**
 * @param { { local?: boolean, random?: boolean, subDir?: string } } [options]
 */
export default async (options = {}) => {
    const local = typeof options.local === "boolean" ? options.local : false;
    const random = typeof options.random === "boolean" ? options.random : true;
    const baseDir = local ? ".tmp" : process.env.RUNNER_TEMP || tmpdir();

    if (random) {
        // mkdtemp 要求父目录预先存在（不同于 mkdir 的 recursive）。
        // 先确保 baseDir 存在，使 local: true（baseDir ".tmp"）或
        // RUNNER_TEMP 指向不存在路径时 mkdtemp 仍能可靠工作。
        await fs.promises.mkdir(baseDir, { recursive: true, mode: 0o700 });
        // 用 mkdtemp 原子创建目录。末尾的 X 由 OS 替换为随机字符，
        // 消除 randomUUID() + mkdir 在名字生成与创建之间的 TOCTOU 窗口
        // （CodeQL js/insecure-temporary-file）。
        // 本实现与 src/mkdtmp.ts 保持一致——该文件是 scripts 侧副本，
        // 此前遗漏了 src 已做的安全修复，现同步。
        const prefix = typeof options.subDir === "string"
            ? `${join(baseDir, options.subDir)}@XXXXXX`
            : join(baseDir, "cached_node-modules@XXXXXX");
        const tempPath = await fs.promises.mkdtemp(prefix);
        console.log("tempPath:", tempPath);
        return tempPath;
    }

    // 确定性目录名——无随机性，不用 mkdtemp。
    const subDir = typeof options.subDir === "string"
        ? options.subDir
        : "cached_node-modules@tmpdir";
    const tempPath = join(baseDir, subDir);
    console.log("tempPath:", tempPath);
    await fs.promises.mkdir(tempPath, { recursive: true, mode: 0o700 });
    return tempPath;
};
