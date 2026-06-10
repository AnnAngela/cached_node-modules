import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetInput = vi.fn();
const mockPlugin = vi.fn();
const mockRetry = Symbol("retry");
const mockCreateActionAuth = Symbol("createActionAuth");
const mockContext = { repo: { owner: "test", repo: "test" } };

vi.mock("@actions/core", () => ({
    getInput: mockGetInput,
    debug: vi.fn(),
}));
vi.mock("@octokit/plugin-retry", () => ({
    retry: mockRetry,
}));
vi.mock("@octokit/auth-action", () => ({
    createActionAuth: mockCreateActionAuth,
}));
vi.mock("@actions/github", () => ({
    context: mockContext,
}));

const mockSuperConstructor = vi.fn();
vi.mock("@octokit/rest", () => {
    // eslint-disable-next-line @typescript-eslint/no-extraneous-class -- mock class for testing Octokit behavior
    class MockOctokit {
        constructor(config: unknown) {
            mockSuperConstructor(config);
        }
        static plugin = (retryPlugin: unknown) => {
            mockPlugin(retryPlugin);
            return class OctokitWithRetry extends MockOctokit {
            };
        };
    }
    return {
        Octokit: MockOctokit,
    };
});

// Clear stored GITHUB_TOKEN between tests
const originalGithubToken = process.env.GITHUB_TOKEN;
beforeEach(() => {
    vi.resetModules();
    mockGetInput.mockReset();
    mockPlugin.mockReset();
    mockSuperConstructor.mockReset();
    process.env.GITHUB_TOKEN = originalGithubToken;
});

describe("Octokit", () => {
    it("should fetch githubToken input, set env, plug retry, use auth strategy, and expose context", async () => {
        mockGetInput.mockReturnValue("gha-token-123");

        const { "default": client } = await import("../Octokit.js");

        // Verify getInput was called
        expect(mockGetInput).toHaveBeenCalledWith("githubToken");

        // Verify GITHUB_TOKEN set
        expect(process.env.GITHUB_TOKEN).toBe("gha-token-123");

        // Verify plugin
        expect(mockPlugin).toHaveBeenCalledWith(mockRetry);

        // Verify auth strategy
        expect(mockSuperConstructor).toHaveBeenCalledWith({
            authStrategy: mockCreateActionAuth,
        });

        // Verify context
        expect(client).toBeDefined();
        expect(client.context).toBe(mockContext);
    });
});
