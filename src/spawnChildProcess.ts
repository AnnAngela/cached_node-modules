import { exec } from "node:child_process";

export interface SpawnChildProcessOptions {
    /**
     * default is `false`
     */
    synchronousStdout?: boolean
    /**
     * default is `false`
     */
    synchronousStderr?: boolean
}

const execCommand = (command: string, options?: SpawnChildProcessOptions) => new Promise((res, rej) => {
    const childProcess = exec(command, (error, stdout, stderr) => {
        if (error) {
            rej(error);
        } else {
            res(stdout);
        }
    });
    if (options?.synchronousStdout) {
        childProcess.stdout?.pipe(process.stdout);
    }
    if (options?.synchronousStderr) {
        childProcess.stderr?.pipe(process.stderr);
    }
})
export default execCommand;
