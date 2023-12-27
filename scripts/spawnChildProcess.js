import { exec } from "node:child_process";
/**
 * @param { string } command
 * @param { { synchronousStdout: boolean, synchronousStderr: boolean} } [options]
 * @returns { Promise<string> }
 */
const execCommand = (command, options) => new Promise((res, rej) => {
    const childProcess = exec(command, (error, stdout) => {
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
