import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { packageLockHandler } from "./lockfileHandler.js";

export const algorithmMap = {
    SHA2_256: "sha256",
    SHA2_512: "sha512",
    SHA3_256: "sha3-256",
    SHA3_512: "sha3-512",
};

export const hashCalc = async (filePath: string, algorithm: keyof typeof algorithmMap): Promise<string> => new Promise((res, rej) => {
    /* eslint-disable promise/prefer-await-to-then */
    const hash = crypto.createHash(algorithmMap[algorithm]);
    const lockfileParsedPath = path.parse(filePath);
    if (lockfileParsedPath.name === "package-lock") {
        packageLockHandler(filePath, lockfileParsedPath).then(({ lockfileContent }) => {
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
