import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { vol, fs as memfs } from 'memfs'

// Mock spawnChildProcess to control version outputs
vi.mock('./spawnChildProcess.js', () => ({
    default: vi.fn(),
}))
// Mock hashCalc
vi.mock('./hashCalc.js', () => ({
    hashCalc: vi.fn(),
    algorithmMap: {
        SHA2_256: 'sha256',
        SHA2_512: 'sha512',
        SHA3_256: 'sha3-256',
        SHA3_512: 'sha3-512',
    },
}))
// Mock Octokit for git commit variables
vi.mock('./Octokit.js', () => {
    const mockReposListCommits = vi.fn()
    return {
        default: {
            context: {
                repo: { owner: 'test-owner', repo: 'test-repo' },
                ref: 'refs/heads/main',
                sha: 'abc123',
            },
            repos: {
                listCommits: mockReposListCommits,
            },
        },
    }
})

vi.mock('@actions/core', () => ({
    debug: vi.fn(),
}))

import spawnChildProcess from './spawnChildProcess.js'
import { hashCalc } from './hashCalc.js'
import octokit from './Octokit.js'

const mockSpawn = spawnChildProcess as ReturnType<typeof vi.fn>
const mockHashCalc = hashCalc as ReturnType<typeof vi.fn>
const mockListCommits = octokit.repos.listCommits as ReturnType<typeof vi.fn>

// We'll import Variable after setting up mocks
let Variable: typeof import('./Variable.js').default

beforeEach(async () => {
    vi.clearAllMocks()
    // Import fresh after mock setup
    const mod = await import('./Variable.js')
    Variable = mod.default
})

describe('Variable', () => {
    describe('OS and Node variables', () => {
        it('should get OS_NAME via node command', async () => {
            mockSpawn.mockImplementation((cmd: string) => {
                if (cmd.includes('process.platform')) return Promise.resolve('linux')
                return Promise.resolve('')
            })

            const v = new Variable('/cwd', '/cwd/lock', '/cwd/pkg.json', '', 'npm')
            const result = await v.get('OS_NAME')
            expect(result).toBe('linux')
        })

        it('should get NODE_ARCH via node command', async () => {
            mockSpawn.mockImplementation((cmd: string) => {
                if (cmd.includes('process.arch')) return Promise.resolve('x64')
                return Promise.resolve('')
            })

            const v = new Variable('/cwd', '/cwd/lock', '/cwd/pkg.json', '', 'npm')
            const result = await v.get('NODE_ARCH')
            expect(result).toBe('x64')
        })

        it('should get NODE_VERSION and derived majors/minors/patch', async () => {
            mockSpawn.mockImplementation((cmd: string) => {
                if (cmd === 'node --version') return Promise.resolve('v20.10.5')
                return Promise.resolve('')
            })

            const v = new Variable('/cwd', '/cwd/lock', '/cwd/pkg.json', '', 'npm')

            expect(await v.get('NODE_VERSION')).toBe('v20.10.5')
            expect(await v.get('NODE_VERSION_MAJOR')).toBe('20')
            expect(await v.get('NODE_VERSION_MINOR')).toBe('10')
            expect(await v.get('NODE_VERSION_PATCH')).toBe('5')
        })
    })

    describe('PM_VERSION — unified package manager version variable', () => {
        it('should get PM_VERSION from npm when packageManager is "npm"', async () => {
            mockSpawn.mockImplementation((cmd: string) => {
                if (cmd === 'npm --version') return Promise.resolve('10.5.0')
                return Promise.resolve('')
            })

            const v = new Variable('/cwd', '/cwd/lock', '/cwd/pkg.json', '', 'npm')
            expect(await v.get('PM_VERSION')).toBe('10.5.0')
        })

        it('should get PM_VERSION from pnpm when packageManager is "pnpm"', async () => {
            mockSpawn.mockImplementation((cmd: string) => {
                if (cmd === 'pnpm --version') return Promise.resolve('9.2.0')
                return Promise.resolve('')
            })

            const v = new Variable('/cwd', '/cwd/lock', '/cwd/pkg.json', '', 'pnpm')
            expect(await v.get('PM_VERSION')).toBe('9.2.0')
        })

        it('should get PM_VERSION from yarn when packageManager is "yarn"', async () => {
            mockSpawn.mockImplementation((cmd: string) => {
                if (cmd === 'yarn --version') return Promise.resolve('4.3.1')
                return Promise.resolve('')
            })

            const v = new Variable('/cwd', '/cwd/lock', '/cwd/pkg.json', '', 'yarn')
            expect(await v.get('PM_VERSION')).toBe('4.3.1')
        })

        it('should derive PM_VERSION_MAJOR/MINOR/PATCH correctly', async () => {
            mockSpawn.mockImplementation((cmd: string) => {
                if (cmd === 'npm --version') return Promise.resolve('10.5.0')
                return Promise.resolve('')
            })

            const v = new Variable('/cwd', '/cwd/lock', '/cwd/pkg.json', '', 'npm')
            expect(await v.get('PM_VERSION_MAJOR')).toBe('10')
            expect(await v.get('PM_VERSION_MINOR')).toBe('5')
            expect(await v.get('PM_VERSION_PATCH')).toBe('0')
        })

        it('should cache PM_VERSION — only call spawn once', async () => {
            mockSpawn.mockImplementation((cmd: string) => {
                if (cmd === 'npm --version') return Promise.resolve('10.5.0')
                return Promise.resolve('')
            })

            const v = new Variable('/cwd', '/cwd/lock', '/cwd/pkg.json', '', 'npm')
            await v.get('PM_VERSION')
            await v.get('PM_VERSION_MAJOR') // uses cached PM_VERSION
            await v.get('PM_VERSION_MINOR') // uses cached PM_VERSION
            await v.get('PM_VERSION_PATCH') // uses cached PM_VERSION

            // PM_VERSION should have been called only once
            const pmVersionCalls = mockSpawn.mock.calls.filter(
                (call: [string]) => call[0] === 'npm --version',
            )
            expect(pmVersionCalls.length).toBe(1)
        })
    })

    describe('PM — package manager name variable', () => {
        it('should return "npm" when packageManager is npm', async () => {
            const v = new Variable('/cwd', '/cwd/lock', '/cwd/pkg.json', '', 'npm')
            expect(await v.get('PM')).toBe('npm')
        })

        it('should return "pnpm" when packageManager is pnpm', async () => {
            const v = new Variable('/cwd', '/cwd/lock', '/cwd/pkg.json', '', 'pnpm')
            expect(await v.get('PM')).toBe('pnpm')
        })

        it('should return "yarn" when packageManager is yarn', async () => {
            const v = new Variable('/cwd', '/cwd/lock', '/cwd/pkg.json', '', 'yarn')
            expect(await v.get('PM')).toBe('yarn')
        })

        it('should not call spawnChildProcess for PM', async () => {
            const v = new Variable('/cwd', '/cwd/lock', '/cwd/pkg.json', '', 'npm')
            await v.get('PM')
            expect(mockSpawn).not.toHaveBeenCalled()
        })
    })

    describe('CUSTOM_VARIABLE', () => {
        it('should return the customVariable value', async () => {
            const v = new Variable('/cwd', '/cwd/lock', '/cwd/pkg.json', ':patches@abc123', 'npm')
            expect(await v.get('CUSTOM_VARIABLE')).toBe(':patches@abc123')
        })
    })

    describe('hash variables', () => {
        it('should compute LOCKFILE_HASH_SHA2_256', async () => {
            mockHashCalc.mockResolvedValue('abc123def456abc123def456abc123def456abc123def456abc123def456abc123')

            const v = new Variable('/cwd', '/cwd/lockfile', '/cwd/pkg.json', '', 'npm')
            const result = await v.get('LOCKFILE_HASH_SHA2_256')
            expect(result).toBe('abc123def456abc123def456abc123def456abc123def456abc123def456abc123')
            expect(mockHashCalc).toHaveBeenCalledWith('/cwd/lockfile', 'SHA2_256')
        })

        it('should compute LOCKFILE_HASH_SHA2_512', async () => {
            mockHashCalc.mockResolvedValue('sha512hash')

            const v = new Variable('/cwd', '/cwd/lockfile', '/cwd/pkg.json', '', 'npm')
            const result = await v.get('LOCKFILE_HASH_SHA2_512')
            expect(result).toBe('sha512hash')
            expect(mockHashCalc).toHaveBeenCalledWith('/cwd/lockfile', 'SHA2_512')
        })

        it('should compute LOCKFILE_HASH_SHA3_256', async () => {
            mockHashCalc.mockResolvedValue('sha3_256hash')

            const v = new Variable('/cwd', '/cwd/lockfile', '/cwd/pkg.json', '', 'npm')
            const result = await v.get('LOCKFILE_HASH_SHA3_256')
            expect(result).toBe('sha3_256hash')
            expect(mockHashCalc).toHaveBeenCalledWith('/cwd/lockfile', 'SHA3_256')
        })

        it('should compute LOCKFILE_HASH_SHA3_512', async () => {
            mockHashCalc.mockResolvedValue('sha3_512hash')

            const v = new Variable('/cwd', '/cwd/lockfile', '/cwd/pkg.json', '', 'npm')
            const result = await v.get('LOCKFILE_HASH_SHA3_512')
            expect(result).toBe('sha3_512hash')
            expect(mockHashCalc).toHaveBeenCalledWith('/cwd/lockfile', 'SHA3_512')
        })

        it('should compute PACKAGEJSON_HASH_SHA2_256', async () => {
            mockHashCalc.mockResolvedValue('xyz789ghi012')

            const v = new Variable('/cwd', '/cwd/lockfile', '/cwd/pkg.json', '', 'npm')
            const result = await v.get('PACKAGEJSON_HASH_SHA2_256')
            expect(result).toBe('xyz789ghi012')
            expect(mockHashCalc).toHaveBeenCalledWith('/cwd/pkg.json', 'SHA2_256')
        })

        it('should compute PACKAGEJSON_HASH_SHA2_512', async () => {
            mockHashCalc.mockResolvedValue('pkgsha512')
            const v = new Variable('/cwd', '/cwd/lockfile', '/cwd/pkg.json', '', 'yarn')
            expect(await v.get('PACKAGEJSON_HASH_SHA2_512')).toBe('pkgsha512')
        })

        it('should compute PACKAGEJSON_HASH_SHA3_256', async () => {
            mockHashCalc.mockResolvedValue('pkgsha3_256')
            const v = new Variable('/cwd', '/cwd/lockfile', '/cwd/pkg.json', '', 'pnpm')
            expect(await v.get('PACKAGEJSON_HASH_SHA3_256')).toBe('pkgsha3_256')
        })

        it('should compute PACKAGEJSON_HASH_SHA3_512', async () => {
            mockHashCalc.mockResolvedValue('pkgsha3_512')
            const v = new Variable('/cwd', '/cwd/lockfile', '/cwd/pkg.json', '', 'yarn')
            expect(await v.get('PACKAGEJSON_HASH_SHA3_512')).toBe('pkgsha3_512')
        })
    })

    describe('git commit variables', () => {
        it('should get LOCKFILE_GIT_COMMIT_LONG from octokit', async () => {
            mockListCommits.mockResolvedValue({
                data: [{ sha: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0' }],
            })

            const v = new Variable('/cwd', '/cwd/lockfile', '/cwd/pkg.json', '', 'npm')
            const result = await v.get('LOCKFILE_GIT_COMMIT_LONG')
            expect(result).toBe('a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0')
        })

        it('should get LOCKFILE_GIT_COMMIT_SHORT (first 7 chars)', async () => {
            mockListCommits.mockResolvedValue({
                data: [{ sha: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0' }],
            })

            const v = new Variable('/cwd', '/cwd/lockfile', '/cwd/pkg.json', '', 'npm')
            const result = await v.get('LOCKFILE_GIT_COMMIT_SHORT')
            expect(result).toBe('a1b2c3d')
        })

        it('should get PACKAGEJSON_GIT_COMMIT_LONG', async () => {
            mockListCommits.mockResolvedValue({
                data: [{ sha: 'z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4' }],
            })
            const v = new Variable('/cwd', '/cwd/lockfile', '/cwd/pkg.json', '', 'npm')
            const result = await v.get('PACKAGEJSON_GIT_COMMIT_LONG')
            expect(result).toBe('z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4')
        })

        it('should get PACKAGEJSON_GIT_COMMIT_SHORT', async () => {
            mockListCommits.mockResolvedValue({
                data: [{ sha: 'z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4' }],
            })
            const v = new Variable('/cwd', '/cwd/lockfile', '/cwd/pkg.json', '', 'npm')
            const result = await v.get('PACKAGEJSON_GIT_COMMIT_SHORT')
            expect(result).toBe('z9y8x7w')
        })
    })

    describe('cache mechanism', () => {
        it('should return cached value on second call', async () => {
            mockSpawn.mockImplementation((cmd: string) => {
                if (cmd.includes('process.platform')) return Promise.resolve('darwin')
                return Promise.resolve('')
            })

            const v = new Variable('/cwd', '/cwd/lock', '/cwd/pkg.json', '', 'npm')
            const r1 = await v.get('OS_NAME')
            const r2 = await v.get('OS_NAME')

            expect(r1).toBe(r2)
            // Should have only been called once for process.platform
            const platformCalls = mockSpawn.mock.calls.filter(
                (call: [string]) => call[0].includes('process.platform'),
            )
            expect(platformCalls.length).toBe(1)
        })
    })

    describe('getCache', () => {
        it('should return frozen cache object', async () => {
            mockSpawn.mockImplementation((cmd: string) => {
                if (cmd.includes('process.platform')) return Promise.resolve('linux')
                return Promise.resolve('')
            })

            const v = new Variable('/cwd', '/cwd/lock', '/cwd/pkg.json', '', 'npm')
            await v.get('OS_NAME')
            const cache = v.getCache()

            expect(cache).toHaveProperty('OS_NAME', 'linux')
            expect(Object.isFrozen(cache)).toBe(true)
        })
    })

    describe('invalid variable name', () => {
        it('should throw for unknown variable', async () => {
            const v = new Variable('/cwd', '/cwd/lock', '/cwd/pkg.json', '', 'npm')
            await expect(v.get('UNKNOWN_VAR' as any)).rejects.toThrow()
        })
    })

    describe('edge cases', () => {
        it('should throw when semver fails to parse PM_VERSION', async () => {
            mockSpawn.mockImplementation((cmd: string) => {
                if (cmd === 'npm --version') return Promise.resolve('not-a-version')
                return Promise.resolve('')
            })

            const v = new Variable('/cwd', '/cwd/lock', '/cwd/pkg.json', '', 'npm')
            await expect(v.get('PM_VERSION_MAJOR')).rejects.toThrow('Failed to parse')
        })

        it('should cache PM_VERSION_MAJOR on repeated calls', async () => {
            mockSpawn.mockImplementation((cmd: string) => {
                if (cmd === 'npm --version') return Promise.resolve('10.5.0')
                return Promise.resolve('')
            })

            const v = new Variable('/cwd', '/cwd/lock', '/cwd/pkg.json', '', 'npm')
            const first = await v.get('PM_VERSION_MAJOR')
            const second = await v.get('PM_VERSION_MAJOR')
            expect(first).toBe('10')
            expect(second).toBe('10')
            // Both returned same value, and cache was used on second call
            const pmCalls = mockSpawn.mock.calls.filter(
                (call: [string]) => call[0] === 'npm --version',
            )
            expect(pmCalls.length).toBe(1)
        })

        it('should cache PM_VERSION_MINOR on repeated calls', async () => {
            mockSpawn.mockImplementation((cmd: string) => {
                if (cmd === 'npm --version') return Promise.resolve('10.5.0')
                return Promise.resolve('')
            })

            const v = new Variable('/cwd', '/cwd/lock', '/cwd/pkg.json', '', 'npm')
            const first = await v.get('PM_VERSION_MINOR')
            const second = await v.get('PM_VERSION_MINOR')
            expect(first).toBe('5')
            expect(second).toBe('5')
        })

        it('should cache PM_VERSION_PATCH on repeated calls', async () => {
            mockSpawn.mockImplementation((cmd: string) => {
                if (cmd === 'npm --version') return Promise.resolve('10.5.0')
                return Promise.resolve('')
            })

            const v = new Variable('/cwd', '/cwd/lock', '/cwd/pkg.json', '', 'npm')
            const first = await v.get('PM_VERSION_PATCH')
            const second = await v.get('PM_VERSION_PATCH')
            expect(first).toBe('0')
            expect(second).toBe('0')
        })
    })
})
