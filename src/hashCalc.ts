import fs from "node:fs";
import crypto from "node:crypto";

export const algorithmMap = {
    SHA2_256: "sha256",
    SHA2_512: "sha512",
    SHA3_256: "sha3-256",
    SHA3_512: "sha3-512",
};

export const hashCalc = async (filePath: string, algorithm: keyof typeof algorithmMap) => {
    const fileContent = await fs.promises.readFile(filePath);
    const hash = crypto.createHash(algorithmMap[algorithm]);
    hash.update(fileContent);
    return hash.digest("hex");
};
