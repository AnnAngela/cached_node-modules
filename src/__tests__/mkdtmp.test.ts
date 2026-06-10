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
vi.mock("node:crypto", () => ({
    randomUUID: () => "test-uuid",
}));

// Mock process.env.RUNNER_TEMP
beforeEach(() => {
    vol.reset();
    // 显式删除 RUNNER_TEMP 以防 CI 环境中该变量已设置
    // 这样 fallback 到 os.tmpdir()（被 mock 为 /tmp）的逻辑才能正确运作
    delete process.env.RUNNER_TEMP;
});

const mkdtmp = (await import("../mkdtmp.js")).default;

describe("mkdtmp", () => {
    it("should create a temp directory with UUID in RUNNER_TEMP by default", async () => {
        vi.stubEnv("RUNNER_TEMP", "/runner/temp");

        const result = await mkdtmp();

        expect(result).toBe("/runner/temp/cached_node-modules@test-uuid");
        const stat = await memfs.promises.stat(result);
        expect(stat.isDirectory()).toBe(true);
    });

    it("should fall back to os.tmpdir() when RUNNER_TEMP is not set", async () => {
        const result = await mkdtmp();

        expect(result).toBe("/tmp/cached_node-modules@test-uuid");
        const stat = await memfs.promises.stat(result);
        expect(stat.isDirectory()).toBe(true);
    });

    it("should use local .tmp directory when local is true", async () => {
        const result = await mkdtmp({ local: true });

        expect(result).toBe(".tmp/cached_node-modules@test-uuid");
        const stat = await memfs.promises.stat(result);
        expect(stat.isDirectory()).toBe(true);
    });

    it("should not include UUID when random is false", async () => {
        const result = await mkdtmp({ random: false });

        expect(result).toBe("/tmp/cached_node-modules@tmpdir");
        const stat = await memfs.promises.stat(result);
        expect(stat.isDirectory()).toBe(true);
    });

    it("should use custom subDir when provided", async () => {
        const result = await mkdtmp({ subDir: "custom-dir" });

        expect(result).toBe("/tmp/custom-dir");
        const stat = await memfs.promises.stat(result);
        expect(stat.isDirectory()).toBe(true);
    });

    it("should combine local and subDir options", async () => {
        const result = await mkdtmp({ local: true, subDir: "my-app-tmp" });

        expect(result).toBe(".tmp/my-app-tmp");
    });

    it("should call mkdir with recursive: true", async () => {
        const mkdirSpy = vi.spyOn(memfs.promises, "mkdir");

        await mkdtmp();

        expect(mkdirSpy).toHaveBeenCalledWith("/tmp/cached_node-modules@test-uuid", {
            recursive: true,
        });
    });
});
