import { beforeEach, describe, expect, it, vi } from "vitest";
import { vol, fs as memfs } from "memfs";

vi.mock("node:fs", () => ({
    "default": memfs,
}));
vi.mock("node:fs/promises", () => ({
    "default": memfs.promises,
    ...memfs.promises,
}));
vi.mock("node:os", () => ({
    tmpdir: () => "/tmp",
}));

beforeEach(async () => {
    vol.reset();
    // Ensure parent directories exist in the virtual filesystem so that
    // memfs's native mkdtemp can create child directories without ENOENT.
    // mkdtemp is NOT mocked — memfs's own implementation is used, which
    // validates that the real mkdtemp integration works correctly.
    await memfs.promises.mkdir("/tmp", { recursive: true });
    Reflect.deleteProperty(process.env, "RUNNER_TEMP");
});

const mkdtmp = (await import("../mkdtmp.js")).default;

describe("mkdtmp", () => {
    describe("random: true (default) — uses mkdtemp for atomic directory creation", () => {
        it("should use mkdtemp with RUNNER_TEMP when set", async () => {
            vi.stubEnv("RUNNER_TEMP", "/runner/temp");
            await memfs.promises.mkdir("/runner/temp", { recursive: true });

            const result = await mkdtmp();

            expect(result).toMatch(/^\/runner\/temp\/cached_node-modules@[A-Za-z0-9]+$/);
            const stat = await memfs.promises.stat(result);
            expect(stat.isDirectory()).toBe(true);
        });

        it("should fall back to os.tmpdir() when RUNNER_TEMP is not set", async () => {
            const result = await mkdtmp();

            expect(result).toMatch(/^\/tmp\/cached_node-modules@[A-Za-z0-9]+$/);
            const stat = await memfs.promises.stat(result);
            expect(stat.isDirectory()).toBe(true);
        });

        it("should use local .tmp directory when local is true", async () => {
            await memfs.promises.mkdir(".tmp", { recursive: true });

            const result = await mkdtmp({ local: true });

            expect(result).toMatch(/^\.tmp\/cached_node-modules@[A-Za-z0-9]+$/);
            const stat = await memfs.promises.stat(result);
            expect(stat.isDirectory()).toBe(true);
        });

        it("should create the baseDir automatically when using local: true and .tmp does not exist", async () => {
            // .tmp is NOT pre-created — mkdtmp should create it via
            // mkdir(recursive: true, mode: 0o700) before calling mkdtemp.
            // This verifies the ENOENT fix: mkdtemp requires the parent
            // directory to exist beforehand.
            const result = await mkdtmp({ local: true });

            expect(result).toMatch(/^\.tmp\/cached_node-modules@[A-Za-z0-9]+$/);
            const stat = await memfs.promises.stat(result);
            expect(stat.isDirectory()).toBe(true);
        });

        it("should create the baseDir automatically when RUNNER_TEMP points to a non-existent directory", async () => {
            vi.stubEnv("RUNNER_TEMP", "/nonexistent/runner/temp");

            const result = await mkdtmp();

            expect(result).toMatch(/^\/nonexistent\/runner\/temp\/cached_node-modules@[A-Za-z0-9]+$/);
            const stat = await memfs.promises.stat(result);
            expect(stat.isDirectory()).toBe(true);
        });

        it("should use mkdtemp with custom subDir", async () => {
            const result = await mkdtmp({ subDir: "custom-dir" });

            expect(result).toMatch(/^\/tmp\/custom-dir@[A-Za-z0-9]+$/);
            const stat = await memfs.promises.stat(result);
            expect(stat.isDirectory()).toBe(true);
        });

        it("should combine local and subDir with mkdtemp", async () => {
            await memfs.promises.mkdir(".tmp", { recursive: true });

            const result = await mkdtmp({ local: true, subDir: "my-app-tmp" });

            expect(result).toMatch(/^\.tmp\/my-app-tmp@[A-Za-z0-9]+$/);
            const stat = await memfs.promises.stat(result);
            expect(stat.isDirectory()).toBe(true);
        });
    });

    describe("random: false — uses mkdir for deterministic directory creation", () => {
        it("should create directory with deterministic name", async () => {
            const result = await mkdtmp({ random: false });

            expect(result).toBe("/tmp/cached_node-modules@tmpdir");
            const stat = await memfs.promises.stat(result);
            expect(stat.isDirectory()).toBe(true);
        });

        it("should create directory with custom subDir", async () => {
            const result = await mkdtmp({ random: false, subDir: "deterministic-dir" });

            expect(result).toBe("/tmp/deterministic-dir");
            const stat = await memfs.promises.stat(result);
            expect(stat.isDirectory()).toBe(true);
        });

        it("should call mkdir with mode: 0o700 when creating baseDir via mkdtemp path", async () => {
            const mkdirSpy = vi.spyOn(memfs.promises, "mkdir");

            await mkdtmp({ local: true });

            // mkdtmp creates baseDir (.tmp) before calling mkdtemp.
            // Verify the mkdir call includes restrictive permissions.
            expect(mkdirSpy).toHaveBeenCalledWith(".tmp", {
                recursive: true,
                mode: 0o700,
            });
        });
    });
});
