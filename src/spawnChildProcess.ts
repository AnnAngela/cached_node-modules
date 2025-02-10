import { execFile } from "node:child_process";
import shellQuote from "shell-quote";
// import { randomUUID } from "node:crypto";
import { debug } from "@actions/core";
import networkError from "./networkError.js";

export interface SpawnChildProcessOptions {
    /**
     * @default false
     */
    synchronousStdout?: boolean;
    /**
     * @default false
     */
    synchronousStderr?: boolean;
    cwd: string;
    /**
     * @default 3
     */
    retryTime?: number;
}

const execCommand = (command: string, options: SpawnChildProcessOptions): Promise<string> => new Promise((res, rej) => {
    debug(`[spawnChildProcess] Start to run command: ${command}, options: ${JSON.stringify(options)}`);
    /* let uuid: string | undefined;
    if (options?.synchronousStdout || options?.synchronousStderr) {
        uuid = randomUUID();
        console.info(`::stop-commands::${uuid}`);
    } */
    const parsedCommand = shellQuote.parse(command).filter((entry) => typeof entry === "string");
    const cmd = parsedCommand[0];
    const args = parsedCommand.slice(1);
    // eslint-disable-next-line promise/prefer-await-to-callbacks
    const childProcess = execFile(cmd, args, { cwd: options.cwd }, (error, stdout, stderr) => {
        /* if (uuid) {
            console.info(`::${uuid}::`);
        } */
        if (error) {
            debug(`[spawnChildProcess] Command "${command}" failed.`);
            if (networkError.some((errorCode) => stderr.includes(errorCode))) {
                const retryTime = options.retryTime ?? 3;
                debug(`[spawnChildProcess] retryTime: ${retryTime}.`);
                if (retryTime > 0) {
                    console.info("[spawnChildProcess] Network error detected, retrying...");
                    // eslint-disable-next-line @typescript-eslint/no-misused-promises
                    setTimeout(async () => {
                        res(await execCommand(command, { ...options, retryTime: retryTime - 1 }));
                    }, 5000);
                    return;
                }
            }
            rej(error as Error);
        } else {
            const result = stdout.trim();
            debug(`[spawnChildProcess] Command "${command}" succeeded, result: ${result}`);
            res(result);
        }
    });
    if (options.synchronousStdout) {
        childProcess.stdout?.pipe(process.stdout);
    }
    if (options.synchronousStderr) {
        childProcess.stderr?.pipe(process.stderr);
    }
});
export default execCommand;
