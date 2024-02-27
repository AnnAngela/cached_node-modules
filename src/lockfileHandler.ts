import fs from "node:fs";
import path from "node:path";
import mkdtmp from "./mkdtmp.js";
import jsonModule from "./jsonModule.js";

type dependencyType = {
    dev: true
    optional?: false
    devOptional?: false
} | {
    dev?: false
    optional: true
    devOptional?: false
} | {
    dev?: false
    optional?: false
    devOptional: true
} | {
    dev?: false
    optional?: false
    devOptional?: false
};

/**
 * @TODO Unfinished
 */
type packageDescriptor = {
    version: string
    integrity: string
    resolved: string
    link?: false
    bundled?: boolean
    requires?: Record<string, string>
    dependencies?: Record<string, packageDescriptor>
} & dependencyType | {
    version: string
    integrity: string
    inBundle: true
} & dependencyType | {
    resolved: string
    link: true
};

/**
 * V3
 */
interface packageLockJSON {
    name: string
    version: string
    lockfileVersion: 3
    requires?: boolean
    packages?: {
        "": packageDescriptor
        [moduleName: string]: packageDescriptor
    }
}

const prepare = async (lockfilePath: string, lockfileParsedPath: path.ParsedPath) => {
    console.info("Found package-lock.json as lockfile, copy to tmp dir and remove unnecessary fields...");
    const tmpdir = await mkdtmp();
    const newLockfilePath = path.join(tmpdir, lockfileParsedPath.base);
    console.info("New lockfilePath:", newLockfilePath);
    await fs.promises.cp(lockfilePath, newLockfilePath, { force: true });
    return { tmpdir, newLockfilePath };
};

const keptKeys = {
    packageLock: [
        "lockfileVersion",
        "packages",
    ],
};

export const packageLockHandler = async (lockfilePath: string, lockfileParsedPath: path.ParsedPath) => {
    const { tmpdir, newLockfilePath } = await prepare(lockfilePath, lockfileParsedPath);
    const lockfile = await jsonModule.readFile(newLockfilePath) as packageLockJSON;
    const keys = Object.keys(lockfile);
    for (const key of keys) {
        if (!keptKeys.packageLock.includes(key)) {
            Reflect.deleteProperty(lockfile, key);
        }
    }
    if (lockfile.packages) {
        Reflect.deleteProperty(lockfile.packages, "");
    }
    await jsonModule.writeFile(newLockfilePath, lockfile);
    return { tmpdir, newLockfilePath };
};
