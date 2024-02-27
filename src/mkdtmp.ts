import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface mkdtmpOptions {
    /**
     * If `true`, need to delete the temporary directory in the end.
     * @default false
     */
    local?: boolean
    /**
     * If `true`, the directory may not be empty.
     * @default false
     */
    random?: boolean
    /**
     * If set, the directory may not be empty.
     * @default false
     */
    subDir?: string
}

export default async (options: mkdtmpOptions = {}) => {
    const local = typeof options.local === "boolean" ? options.local : false;
    const random = typeof options.random === "boolean" ? options.random : true;
    const subDir = typeof options.subDir === "string" ? options.subDir : `cached_node-modules@${random ? randomUUID() : "tmpdir"}`;
    const tempPath = join(local ? ".tmp" : process.env.RUNNER_TEMP ?? tmpdir(), subDir);
    console.log("tempPath:", tempPath);
    await fs.promises.mkdir(tempPath, {
        recursive: true,
    });
    return tempPath;
};
