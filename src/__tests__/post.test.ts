import { afterEach, describe, expect, it, vi } from "vitest";

const mockGetState = vi.fn();
const mockWarning = vi.fn();
const mockDeleteActionsCacheByKey = vi.fn();

vi.mock("@actions/core", () => ({
    getState: mockGetState,
    warning: mockWarning,
    debug: vi.fn(),
}));

vi.mock("../Octokit.js", () => ({
    "default": {
        context: {
            repo: { owner: "test-owner", repo: "test-repo" },
            ref: "refs/heads/main",
        },
        actions: {
            deleteActionsCacheByKey: mockDeleteActionsCacheByKey,
        },
    },
}));

afterEach(() => {
    vi.resetModules();
    mockGetState.mockReset();
    mockWarning.mockReset();
    mockDeleteActionsCacheByKey.mockReset();
    // Clear console.info mock if needed
    vi.restoreAllMocks();
});

describe("post", () => {
    it('should skip deletion when cacheSaved is not "true"', async () => {
        mockGetState.mockImplementation((key: string) => {
            if (key === "cacheSaved") {
                return "false";
            }
            if (key === "cacheKey") {
                return "my-cache-key";
            }
            return "";
        });
        mockDeleteActionsCacheByKey.mockResolvedValue(undefined);

        await import("../post.js");

        expect(mockDeleteActionsCacheByKey).not.toHaveBeenCalled();
        expect(mockWarning).not.toHaveBeenCalled();
    });

    it("should skip deletion when cacheKey is empty", async () => {
        mockGetState.mockImplementation((key: string) => {
            if (key === "cacheSaved") {
                return "true";
            }
            if (key === "cacheKey") {
                return "";
            }
            return "";
        });
        mockDeleteActionsCacheByKey.mockResolvedValue(undefined);

        await import("../post.js");

        expect(mockDeleteActionsCacheByKey).not.toHaveBeenCalled();
    });

    it('should call deleteActionsCacheByKey when cacheSaved is "true" and cacheKey exists', async () => {
        mockGetState.mockImplementation((key: string) => {
            if (key === "cacheSaved") {
                return "true";
            }
            if (key === "cacheKey") {
                return "my-cache-key-123";
            }
            return "";
        });
        mockDeleteActionsCacheByKey.mockResolvedValue(undefined);

        await import("../post.js");

        expect(mockDeleteActionsCacheByKey).toHaveBeenCalledWith({
            owner: "test-owner",
            repo: "test-repo",
            key: "my-cache-key-123",
            ref: "refs/heads/main",
        });
    });

    it("should call warning when deleteActionsCacheByKey fails with Error", async () => {
        mockGetState.mockImplementation((key: string) => {
            if (key === "cacheSaved") {
                return "true";
            }
            if (key === "cacheKey") {
                return "my-cache-key";
            }
            return "";
        });
        mockDeleteActionsCacheByKey.mockRejectedValue(new Error("API rate limit exceeded"));

        await import("../post.js");

        await vi.waitFor(() => {
            expect(mockWarning).toHaveBeenCalled();
        });

        expect(mockWarning).toHaveBeenCalledWith(
            expect.stringContaining("Failed to delete cache"),
        );
    });

    it("should call warning when deleteActionsCacheByKey fails with non-Error", async () => {
        mockGetState.mockImplementation((key: string) => {
            if (key === "cacheSaved") {
                return "true";
            }
            if (key === "cacheKey") {
                return "non-error-key";
            }
            return "";
        });
        mockDeleteActionsCacheByKey.mockRejectedValue("plain string error");

        await import("../post.js");

        await vi.waitFor(() => {
            expect(mockWarning).toHaveBeenCalled();
        });

        // For non-Error, String(error) is used
        expect(mockWarning).toHaveBeenCalledWith(
            expect.stringContaining("plain string error"),
        );
    });
});
