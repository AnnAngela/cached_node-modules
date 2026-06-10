/**
 * Shared type aliases for test files.
 *
 * These types mirror the real Node.js signatures closely enough for test
 * purposes, without pulling in full `@types/node` types that would add
 * unnecessary imports to every test file.
 */

/** Callback signature matching Node.js `execFile`'s callback. */
export type ExecFileCallback = (error: Error | null, stdout: string, stderr: string) => void;
