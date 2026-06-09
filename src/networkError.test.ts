import { describe, expect, it } from 'vitest'
import networkError from './networkError.js'

describe('networkError', () => {
    describe('npm', () => {
        it.each(['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EPIPE', 'ETIMEDOUT'] as const)(
            'should match npm ERR! code %s',
            (errorCode) => {
                const stderrLine = `npm ERR! code ${errorCode}`

                const matched = networkError.some((pattern) => stderrLine.includes(pattern))

                expect(matched).toBe(true)
            },
        )

        it('should not match npm ERR! for non-network errors', () => {
            const stderrLine = 'npm ERR! code E404'

            const matched = networkError.some((pattern) => stderrLine.includes(pattern))

            expect(matched).toBe(false)
        })
    })

    describe('Yarn Classic v1', () => {
        it('should match "There appears to be trouble with your network connection"', () => {
            const stderrLine = 'info There appears to be trouble with your network connection. Retrying...'

            const matched = networkError.some((pattern) => stderrLine.includes(pattern))

            expect(matched).toBe(true)
        })

        it.each(['ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND'] as const)(
            'should match "An unexpected error occurred ... %s"',
            (errorCode) => {
                const stderrLine = `error An unexpected error occurred: "https://registry.yarnpkg.com/some-pkg: ${errorCode}"`

                const matched = networkError.some((pattern) => stderrLine.includes(pattern))

                expect(matched).toBe(true)
            },
        )

        it('should not match a non-network Yarn error', () => {
            const stderrLine = 'error An unexpected error occurred: "EACCES: permission denied"'

            const matched = networkError.some((pattern) => stderrLine.includes(pattern))

            expect(matched).toBe(false)
        })
    })

    describe('Yarn Berry v2+', () => {
        it.each(['ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND'] as const)(
            'should match YN0001 with %s',
            (errorCode) => {
                const stderrLine = `➤ YN0001: │ GotError: connect ${errorCode} 104.16.24.35:443`

                const matched = networkError.some((pattern) => stderrLine.includes(pattern))

                expect(matched).toBe(true)
            },
        )

        it('should not match YN0001 without network error codes', () => {
            const stderrLine = '➤ YN0001: │ SomeError: package not found'

            const matched = networkError.some((pattern) => stderrLine.includes(pattern))

            expect(matched).toBe(false)
        })
    })

    describe('pnpm', () => {
        it.each(['ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EPIPE'] as const)(
            'should match ERR_PNPM_FETCH_ with %s',
            (errorCode) => {
                const stderrLine = `ERR_PNPM_FETCH_404  ${errorCode}: request to https://registry.npmjs.org/some-pkg failed`

                const matched = networkError.some((pattern) => stderrLine.includes(pattern))

                expect(matched).toBe(true)
            },
        )

        it('should match WARN GET error for network issues', () => {
            const stderrLine = 'WARN GET https://registry.npmjs.org/ error (ETIMEDOUT). Will retry in 10 seconds'

            const matched = networkError.some((pattern) => stderrLine.includes(pattern))

            expect(matched).toBe(true)
        })

        it('should not match non-network pnpm errors', () => {
            const stderrLine = 'ERR_PNPM_NO_MATCHING_VERSION  No matching version found for foo@1.0.0'

            const matched = networkError.some((pattern) => stderrLine.includes(pattern))

            expect(matched).toBe(false)
        })
    })

    describe('non-error strings', () => {
        it('should not match normal output', () => {
            const normal = 'Successfully installed 42 packages'

            const matched = networkError.some((pattern) => normal.includes(pattern))

            expect(matched).toBe(false)
        })

        it('should not match empty string', () => {
            const matched = networkError.some((pattern) => ''.includes(pattern))

            expect(matched).toBe(false)
        })
    })
})
