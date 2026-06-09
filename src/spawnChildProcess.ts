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
    const parsedCommand = shellQuote.parse(command).filter((entry) => typeof entry === "string");
    const cmd = parsedCommand[0];
    const args = parsedCommand.slice(1);

    // Wait for any piped stdout/stderr to fully drain to the OS before
    // resolving the Promise. Without this, process.exit() can cut off
    // buffered pipe data, causing truncated workflow output and lost
    // workflow commands (e.g. ::debug::, ::group::).
    // `process.stdout.write("", cb)` invokes cb after all buffered data
    // has been flushed to the OS pipe — the correct replacement for
    // a fixed setTimeout() delay.
    const drainStreamsAndThen = async (fn: () => void) => {
        const drains: Promise<void>[] = [];
        if (options.synchronousStdout) {
            drains.push(new Promise<void>((resolve) => {
                process.stdout.write("", () => {
                    resolve();
                });
            }));
        }
        if (options.synchronousStderr) {
            drains.push(new Promise<void>((resolve) => {
                process.stderr.write("", () => {
                    resolve();
                });
            }));
        }
        if (drains.length > 0) {
            try {
                await Promise.all(drains);
            } catch {
                // drain failure is non-fatal — fall through
            }
        }
        fn();
    };

    // eslint-disable-next-line promise/prefer-await-to-callbacks, @typescript-eslint/no-misused-promises
    const childProcess = execFile(cmd, args, { cwd: options.cwd }, async (error, stdout, stderr) => {
        if (error) {
            debug(`[spawnChildProcess] Command "${command}" failed.`);
            // Split stderr into lines and check each line against network error patterns.
            // This prevents false positives where a non-network error code appears
            // incidentally in a different context within the same stderr output.
            if (stderr.split("\n").some((line) => networkError.some((errorCode) => line.includes(errorCode)))) {
                const retryTime = options.retryTime ?? 3;
                debug(`[spawnChildProcess] retryTime: ${retryTime}.`);
                if (retryTime > 0) {
                    console.info("[spawnChildProcess] Network error detected, retrying...");
                    setTimeout(() => {
                        // `res(innerPromise)` is valid per Promise/A+ — the outer
                        // promise resolves/rejects with the inner promise's outcome.
                        res(execCommand(command, { ...options, retryTime: retryTime - 1 }));
                    }, 5000);
                    return;
                }
            }
            const execError: Error = error;
            await drainStreamsAndThen(() => {
                rej(execError);
            });
        } else {
            const result = stdout.trim();
            debug(`[spawnChildProcess] Command "${command}" succeeded, result: ${result}`);
            await drainStreamsAndThen(() => {
                res(result);
            });
        }
    });
    if (options.synchronousStdout) {
        childProcess.stdout.pipe(process.stdout);
    }
    if (options.synchronousStderr) {
        childProcess.stderr.pipe(process.stderr);
    }
});
export default execCommand;
