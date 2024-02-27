import fs from "node:fs";

export const readFile = async (path: fs.PathLike | fs.promises.FileHandle) => JSON.parse(await fs.promises.readFile(path, { encoding: "utf-8" })) as unknown;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const writeFile = async (path: fs.PathLike | fs.promises.FileHandle, value: any, space: string | number | undefined = 4) => {
    await fs.promises.writeFile(path, `${JSON.stringify(value, null, space)}\n`, { encoding: "utf-8" });
};

export default { readFile, writeFile };
