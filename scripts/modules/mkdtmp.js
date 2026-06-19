import fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import console from "../modules/console.js";

/**
 * 在 CI 临时目录下用 mkdtemp 原子创建一个唯一子目录。
 * mkdtemp 末尾的 X 由 OS 替换为随机字符，消除 randomUUID + mkdir
 * 在名字生成与创建之间的 TOCTOU 窗口（CodeQL js/insecure-temporary-file）。
 *
 * 跨进程复用同一目录（如 before.js → after.js）不应重复调用本函数，
 * 而应由首次调用方把返回路径经指针文件传递给后续进程。
 */
export default async () => {
    const baseDir = process.env.RUNNER_TEMP || tmpdir();
    // mkdtemp 要求父目录预先存在（不同于 mkdir 的 recursive）。
    // 先确保 baseDir 存在，使 RUNNER_TEMP 指向不存在路径时 mkdtemp 仍能可靠工作。
    await fs.promises.mkdir(baseDir, { recursive: true, mode: 0o700 });
    const prefix = join(baseDir, "cached_node-modules@XXXXXX");
    const tempPath = await fs.promises.mkdtemp(prefix);
    console.log("tempPath:", tempPath);
    return tempPath;
};
