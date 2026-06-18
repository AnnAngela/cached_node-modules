import fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import console from "../modules/console.js";

/**
 * 在 CI 临时目录下原子创建一个唯一子目录。
 *
 * @param { { subDir: string } } options - subDir 为子目录名前缀（必填）
 */
export default async ({ subDir }) => {
    const baseDir = process.env.RUNNER_TEMP || tmpdir();
    // mkdtemp 要求父目录预先存在（不同于 mkdir 的 recursive）。
    // 先确保 baseDir 存在，使 RUNNER_TEMP 指向不存在路径时 mkdtemp 仍能可靠工作。
    await fs.promises.mkdir(baseDir, { recursive: true, mode: 0o700 });
    // 用 mkdtemp 原子创建目录。末尾的 X 由 OS 替换为随机字符，
    // 消除 randomUUID() + mkdir 在名字生成与创建之间的 TOCTOU 窗口
    // （CodeQL js/insecure-temporary-file）。
    const prefix = `${join(baseDir, subDir)}@XXXXXX`;
    const tempPath = await fs.promises.mkdtemp(prefix);
    console.log("tempPath:", tempPath);
    return tempPath;
};
