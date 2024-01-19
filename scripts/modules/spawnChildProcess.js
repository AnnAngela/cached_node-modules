import { exec } from "node:child_process";
/**
 * @param { string } command
 * @param { { synchronousStdout: boolean, synchronousStderr: boolean, cwd?: string } } [options]
 * @returns { Promise<string> }
 */
const execCommand = (command, options) => new Promise((res, rej) => {
    const opt = {};
    if (typeof options?.cwd === "string") {
        opt.cwd = options.cwd;
    }
    // eslint-disable-next-line promise/prefer-await-to-callbacks
    const childProcess = exec(command, opt, (error, stdout) => {
        if (error) {
            rej(error);
        } else {
            res(stdout.trim());
        }
    });
    if (options?.synchronousStdout) {
        childProcess.stdout?.pipe(process.stdout);
    }
    if (options?.synchronousStderr) {
        childProcess.stderr?.pipe(process.stderr);
    }
});
export default execCommand;
