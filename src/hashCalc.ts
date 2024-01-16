import fs from "node:fs";
import crypto from "node:crypto";

export const algorithmMap = {
    SHA2_256: "sha256",
    SHA2_512: "sha512",
    SHA3_256: "sha3-256",
    SHA3_512: "sha3-512",
};

export const hashCalc = async (filePath: string, algorithm: keyof typeof algorithmMap): Promise<string> => new Promise((res, rej) => {
    const fileStream = fs.createReadStream(filePath);
    const hash = crypto.createHash(algorithmMap[algorithm]);
    fileStream.on("data", (data) => {
        hash.update(data);
    });
    fileStream.on("end", () => {
        res(hash.digest("hex"));
    });
    fileStream.on("error", rej);
});
