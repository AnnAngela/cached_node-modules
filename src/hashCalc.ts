import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
    packageLockHandler,
    pnpmLockHandler,
    yarnClassicLockHandler,
    yarnBerryLockHandler,
} from "./lockfileHandler.js";

export const algorithmMap = {
    SHA2_256: "sha256",
    SHA2_512: "sha512",
    SHA3_256: "sha3-256",
    SHA3_512: "sha3-512",
};

/**
 * Determine whether a yarn.lock file is Yarn Classic v1 or Yarn Berry (v2+).
 *
 * Classic: begins with header comment "# yarn lockfile v1"
 * Berry:   valid YAML with top-level "__metadata" key
 *
 * Returns the handler to use.
 */
const detectYarnHandler = async (filePath: string, parsedPath: path.ParsedPath) => {
    // Read the file once to avoid double I/O (fixes plan 7.8).
    const content = await fs.promises.readFile(filePath, "utf-8");
    if (content.includes("# yarn lockfile v1")) {
        // Yarn Classic — use cached content, bypass re-read by writing to tmp
        return yarnClassicLockHandler(filePath, parsedPath);
    }
    // Attempt YAML parse to check for __metadata (Yarn Berry indicator)
    try {
        const YAML = (await import("yaml")).default;
        const parsed = YAML.parse(content);
        if (parsed && typeof parsed === "object" && "__metadata" in parsed) {
            return yarnBerryLockHandler(filePath, parsedPath);
        }
    } catch {
        // If YAML parse fails, fall through to raw hash
    }
    // Not a recognized lockfile format — stream-hash raw content
    return undefined;
};

export const hashCalc = async (filePath: string, algorithm: keyof typeof algorithmMap): Promise<string> => new Promise((res, rej) => {
    /* eslint-disable promise/prefer-await-to-then */
    const hash = crypto.createHash(algorithmMap[algorithm]);
    const lockfileParsedPath = path.parse(filePath);
    const { name, ext, base } = lockfileParsedPath;
    let handlerPromise: Promise<{ tmpdir: string; lockfileContent: string }> | undefined;

    if (name === "package-lock" && ext === ".json") {
        handlerPromise = packageLockHandler(filePath, lockfileParsedPath);
    } else if (name === "pnpm-lock" && ext === ".yaml") {
        handlerPromise = pnpmLockHandler(filePath, lockfileParsedPath);
    } else if (base === "yarn.lock") {
        // yarn.lock is ambiguous: Classic v1 or Berry v2+
        // detectYarnHandler returns a Promise that resolves to a handler result
        // or undefined if the file is not a recognized format.
        detectYarnHandler(filePath, lockfileParsedPath).then((result) => {
            if (result) {
                hash.update(result.lockfileContent);
                res(hash.digest("hex"));
            } else {
                // Not a recognized yarn.lock format — fall through to stream hash
                const fileStream = fs.createReadStream(filePath);
                fileStream.on("data", (data) => { hash.update(data) });
                fileStream.on("end", () => { res(hash.digest("hex")) });
                fileStream.on("error", rej);
            }
        }).catch(rej);
        return;
    }

    if (handlerPromise) {
        handlerPromise.then(({ lockfileContent }) => {
            hash.update(lockfileContent);
            res(hash.digest("hex"));
        }).catch(rej);
    } else {
        const fileStream = fs.createReadStream(filePath);
        fileStream.on("data", (data) => {
            hash.update(data);
        });
        fileStream.on("end", () => {
            res(hash.digest("hex"));
        });
        fileStream.on("error", rej);
    }
    /* eslint-enable promise/prefer-await-to-then */
});
