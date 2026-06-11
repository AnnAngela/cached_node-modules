import { describe, expect, it } from "vitest";
import networkError from "../networkError.js";

describe("networkError", () => {
    describe("npm", () => {
        it.each(["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EPIPE", "ETIMEDOUT"] as const)(
            "should match npm ERR! code %s",
            (errorCode) => {
                const stderrLine = `npm ERR! code ${errorCode}`;

                const matched = networkError.some((pattern) => stderrLine.includes(pattern));

                expect(matched).toBe(true);
            },
        );

        it("should not match npm ERR! for non-network errors", () => {
            const stderrLine = "npm ERR! code E404";

            const matched = networkError.some((pattern) => stderrLine.includes(pattern));

            expect(matched).toBe(false);
        });
    });

    describe("Yarn Classic v1", () => {
        it('should match "There appears to be trouble with your network connection"', () => {
            const stderrLine = "info There appears to be trouble with your network connection. Retrying...";

            const matched = networkError.some((pattern) => stderrLine.includes(pattern));

            expect(matched).toBe(true);
        });

        it("should match npm ERR! code ETIMEDOUT in Yarn Classic context", () => {
            const stderrLine = "error An unexpected error occurred: \"https://registry.yarnpkg.com/some-pkg: ETIMEDOUT\"";

            const matched = networkError.some((pattern) => stderrLine.includes(pattern));

            // Bare errno codes (ETIMEDOUT) are NOT in the exported list —
            // only the npm-prefixed "npm ERR! code ETIMEDOUT" form is present.
            // Yarn Classic's "There appears to be trouble..." pattern handles
            // the Yarn Classic retry message independently.
            expect(matched).toBe(false);
        });

        it("should not match a non-network Yarn error", () => {
            const stderrLine = 'error An unexpected error occurred: "EACCES: permission denied"';

            const matched = networkError.some((pattern) => stderrLine.includes(pattern));

            expect(matched).toBe(false);
        });
    });

    describe("Yarn Berry v2+", () => {
        it("should match YN0049 (network unreachable) directly", () => {
            const stderrLine = "➤ YN0049: │ The remote server failed to provide the requested resource";

            const matched = networkError.some((pattern) => stderrLine.includes(pattern));

            expect(matched).toBe(true);
        });

        it("should NOT match YN0001 without network error codes (generic exception)", () => {
            // YN0001 is a generic exception code in Yarn Berry, not network-specific.
            // Retrying on YN0001 is pointless for permanent config errors like
            // incompatible Node.js versions or package.json syntax errors.
            const stderrLine = "➤ YN0001: │ SomeError: package not found";

            const matched = networkError.some((pattern) => stderrLine.includes(pattern));

            expect(matched).toBe(false);
        });

        it("should NOT match YN0058 (peer dependency resolution)", () => {
            // YN0058 indicates peer-dependency resolution failures, not network issues.
            const stderrLine = "➤ YN0058: │ something-fetch: Failed to fetch peer dependencies";

            const matched = networkError.some((pattern) => stderrLine.includes(pattern));

            expect(matched).toBe(false);
        });

        it("should NOT match YN0001 with bare ETIMEDOUT (bare codes no longer exported)", () => {
            // Bare errno codes are no longer exported — only npm-prefixed
            // "npm ERR! code ETIMEDOUT" is present. YN0049 is the only
            // Yarn-Berry-specific network code kept.
            const stderrLine = "➤ YN0001: │ GotError: connect ETIMEDOUT 104.16.24.35:443";

            const matched = networkError.some((pattern) => stderrLine.includes(pattern));

            expect(matched).toBe(false);
        });
    });

    describe("pnpm", () => {
        it.each(["ETIMEDOUT", "ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EPIPE"] as const)(
            "should match ERR_PNPM_FETCH_ with %s",
            (errorCode) => {
                const stderrLine = `ERR_PNPM_FETCH_404  ${errorCode}: request to https://registry.npmjs.org/some-pkg failed`;

                const matched = networkError.some((pattern) => stderrLine.includes(pattern));

                expect(matched).toBe(true);
            },
        );

        it("should match ERR_PNPM_FETCH_404 directly as error code pattern", () => {
            const stderrLine = "ERR_PNPM_FETCH_404  request to https://registry.npmjs.org/some-pkg failed, reason: package not found";

            const matched = networkError.some((pattern) => stderrLine.includes(pattern));

            expect(matched).toBe(true);
        });

        it("should match ERR_PNPM_FETCH_001 directly (lockfile fail)", () => {
            const stderrLine = "ERR_PNPM_FETCH_001  An unexpected error occurred";

            const matched = networkError.some((pattern) => stderrLine.includes(pattern));

            expect(matched).toBe(true);
        });

        it("should NOT match WARN GET error for bare ETIMEDOUT (bare codes removed)", () => {
            // Bare errno codes are no longer exported. pnpm network errors
            // are covered by the ERR_PNPM_FETCH_* patterns and the npm-prefixed
            // "npm ERR! code ETIMEDOUT" pattern.
            const stderrLine = "WARN GET https://registry.npmjs.org/ error (ETIMEDOUT). Will retry in 10 seconds";

            const matched = networkError.some((pattern) => stderrLine.includes(pattern));

            expect(matched).toBe(false);
        });

        it("should not match non-network pnpm errors", () => {
            const stderrLine = "ERR_PNPM_NO_MATCHING_VERSION  No matching version found for foo@1.0.0";

            const matched = networkError.some((pattern) => stderrLine.includes(pattern));

            expect(matched).toBe(false);
        });
    });

    describe("non-error strings", () => {
        it("should not match normal output", () => {
            const normal = "Successfully installed 42 packages";

            const matched = networkError.some((pattern) => normal.includes(pattern));

            expect(matched).toBe(false);
        });

        it("should not match empty string", () => {
            const matched = networkError.some((pattern) => "".includes(pattern));

            expect(matched).toBe(false);
        });
    });
});
