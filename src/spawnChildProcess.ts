import { exec } from "node:child_process";
// import { randomUUID } from "node:crypto";
import { debug } from "@actions/core";

export interface SpawnChildProcessOptions {
    /**
     * @default false
     */
    synchronousStdout?: boolean
    /**
     * @default false
     */
    synchronousStderr?: boolean
    cwd: string
}

const execCommand = (command: string, options: SpawnChildProcessOptions): Promise<string> => new Promise((res, rej) => {
    debug(`[spawnChildProcess] Start to run command: ${command}, options: ${JSON.stringify(options)}`);
    /* let uuid: string | undefined;
    if (options?.synchronousStdout || options?.synchronousStderr) {
        uuid = randomUUID();
        console.info(`::stop-commands::${uuid}`);
    } */
    // eslint-disable-next-line promise/prefer-await-to-callbacks
    const childProcess = exec(command, { cwd: options.cwd }, (error, stdout) => {
        /* if (uuid) {
            console.info(`::${uuid}::`);
        } */
        if (error) {
            debug(`[spawnChildProcess] Command "${command}" failed.`);
            rej(error);
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
