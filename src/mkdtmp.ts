import fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface mkdtmpOptions {
    /**
     * If `true`, need to delete the temporary directory in the end.
     * @default false
     */
    local?: boolean;
    /**
     * If `true`, use {@link fs.promises.mkdtemp} to create a unique
     * directory atomically. If `false`, create a deterministic directory
     * with a fixed name via {@link fs.promises.mkdir}.
     * @default true
     */
    random?: boolean;
    /**
     * If set, the directory may not be empty.
     * @default false
     */
    subDir?: string;
}

export default async (options: mkdtmpOptions = {}) => {
    const local = typeof options.local === "boolean" ? options.local : false;
    const random = typeof options.random === "boolean" ? options.random : true;
    const baseDir = local ? ".tmp" : process.env.RUNNER_TEMP ?? tmpdir();

    if (random) {
        // Use mkdtemp for atomic directory creation. The trailing X's are
        // replaced by the OS with random characters, eliminating the TOCTOU
        // window between name generation and mkdir that randomUUID() + mkdir
        // would have (CodeQL js/insecure-temporary-file).
        const prefix = typeof options.subDir === "string"
            ? `${join(baseDir, options.subDir)}@XXXXXX`
            : join(baseDir, "cached_node-modules@XXXXXX");
        const tempPath = await fs.promises.mkdtemp(prefix);
        console.log("tempPath:", tempPath);
        return tempPath;
    }

    // Deterministic directory name — no randomness, no mkdtemp.
    const subDir = typeof options.subDir === "string"
        ? options.subDir
        : "cached_node-modules@tmpdir";
    const tempPath = join(baseDir, subDir);
    console.log("tempPath:", tempPath);
    await fs.promises.mkdir(tempPath, { recursive: true });
    return tempPath;
};
