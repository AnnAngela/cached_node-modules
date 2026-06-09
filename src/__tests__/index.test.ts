import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { vol, fs as memfs } from 'memfs'

// ── Mocks ──────────────────────────────────────────────────────────

const mockIsFeatureAvailable = vi.fn()
const mockRestoreCache = vi.fn()
const mockSaveCache = vi.fn()

vi.mock('@actions/cache', () => ({
    isFeatureAvailable: mockIsFeatureAvailable,
    restoreCache: mockRestoreCache,
    saveCache: mockSaveCache,
}))

const mockCoreInputs: Record<string, string> = {}
const mockCoreStates: Record<string, string> = {}
const mockCoreOutputs: Record<string, string> = {}
const mockCoreInflight: string[] = []

vi.mock('@actions/core', () => ({
    getInput: vi.fn((name: string) => mockCoreInputs[name] ?? ''),
    saveState: vi.fn((key: string, value: string) => { mockCoreStates[key] = value }),
    setOutput: vi.fn((key: string, value: string) => { mockCoreOutputs[key] = value }),
    debug: vi.fn(),
    startGroup: vi.fn(),
    endGroup: vi.fn(),
    info: vi.fn(),
}))

// Mock child_process
const mockExecFile = vi.fn()
vi.mock('node:child_process', () => ({
    execFile: mockExecFile,
}))

// Mock fs/promises for access checks
vi.mock('node:fs', () => ({
    default: memfs,
    promises: { access: memfs.promises.access },
    constants: { R_OK: 4 },
}))

vi.mock('node:fs/promises', () => ({
    default: memfs.promises,
    access: memfs.promises.access,
}))

// Mock shel-quote
vi.mock('shell-quote', () => ({
    default: {
        parse: (cmd: string) => cmd.split(' '),
    },
}))

// Mock Octokit (used by Variable internally)
vi.mock('../Octokit.js', () => ({
    default: {
        context: {
            repo: { owner: 'test-owner', repo: 'test-repo' },
            ref: 'refs/heads/main',
            sha: 'abc123',
        },
        repos: {
            listCommits: vi.fn().mockRejectedValue(new Error('not called in tests')),
        },
    },
}))

import { getInput, saveState, setOutput } from '@actions/core'

const mockGetInput = getInput as ReturnType<typeof vi.fn>
const mockSaveState = saveState as ReturnType<typeof vi.fn>
const mockSetOutput = setOutput as ReturnType<typeof vi.fn>

// Helpers

/** Create a minimal set of lockfile + package.json files for a given package manager */
function setupFiles(pm: string, lockfilePath: string) {
    vol.reset()
    const lockContent = pm === 'npm' ? JSON.stringify({
        lockfileVersion: 3,
        packages: { 'node_modules/foo': { version: '1.0.0' } },
    }) : `# test ${pm} lockfile\nsome content`

    vol.fromJSON({
        [lockfilePath]: lockContent,
        '/project/package.json': '{"name":"test","version":"1.0.0"}',
        '/project/package-lock.json': JSON.stringify({
            lockfileVersion: 3,
            packages: { 'node_modules/foo': { version: '1.0.0' } },
        }),
        '/project/pnpm-lock.yaml': `lockfileVersion: '9.0'\nimporters:\n  .: {}\npackages:\n  /foo/1.0.0:\n    resolution:\n      integrity: sha512-xxx\nsnapshots:\n  foo@1.0.0: {}`,
        '/project/yarn.lock': '# yarn lockfile v1\nfoo@^1.0.0:\n  version "1.0.0"',
    })
}

function resetState() {
    vi.resetModules()
    vi.clearAllMocks()
    Object.keys(mockCoreInputs).forEach(k => delete mockCoreInputs[k])
    Object.keys(mockCoreStates).forEach(k => delete mockCoreStates[k])
    Object.keys(mockCoreOutputs).forEach(k => delete mockCoreOutputs[k])
    mockCoreInflight.length = 0
    mockIsFeatureAvailable.mockReturnValue(true)
    mockRestoreCache.mockResolvedValue(undefined)
    mockSaveCache.mockResolvedValue(123)
}

function setInput(name: string, value: string) {
    mockCoreInputs[name] = value
}

beforeEach(() => {
    resetState()
    vol.reset()
    // Provide a default ChildProcess-like return value for execFile.
    // Each test that triggers spawnChildProcess with synchronousStdout
    // must return { stdout: { pipe: vi.fn() }, stderr: { pipe: vi.fn() } }
    // from its mockImplementation. This default is overridden by any
    // mockImplementation call, but serves as a safe fallback.
    mockExecFile.mockReturnValue({ stdout: { pipe: vi.fn() }, stderr: { pipe: vi.fn() } })
})

afterEach(() => {
    vi.restoreAllMocks()
})

// ── Tests ──────────────────────────────────────────────────────────

describe('index', () => {
    describe('packageManager default value derivation', () => {
        it('should default to package-lock.json and npm ci for npm', async () => {
            mockIsFeatureAvailable.mockReturnValue(false) // throws early after input parsing
            setInput('packageManager', 'npm')
            setInput('command', '') // empty → should derive "npm ci"
            setInput('lockfilePath', '') // empty → should derive "package-lock.json"

            await expect(import('../index.js')).rejects.toThrow('Cache feature is not available.')
        })

        it('should default to pnpm-lock.yaml and pnpm install --frozen-lockfile for pnpm', async () => {
            mockIsFeatureAvailable.mockReturnValue(false)
            setInput('packageManager', 'pnpm')

            await expect(import('../index.js')).rejects.toThrow('Cache feature is not available.')
        })

        it('should default to yarn.lock and yarn install --frozen-lockfile for yarn', async () => {
            mockIsFeatureAvailable.mockReturnValue(false)
            setInput('packageManager', 'yarn')

            await expect(import('../index.js')).rejects.toThrow('Cache feature is not available.')
        })

        it('should throw for invalid packageManager', async () => {
            setInput('packageManager', 'foo')

            await expect(import('../index.js')).rejects.toThrow('Invalid packageManager')
        })

        it('should default to npm when packageManager is empty string or not set', async () => {
            mockIsFeatureAvailable.mockReturnValue(true)
            mockRestoreCache.mockResolvedValue('exact-key')
            setupFiles('npm', '/project/package-lock.json')
            setInput('cwd', '/project')
            setInput('cacheKey', 'exact-key')
            // NOT setting packageManager → getInput returns '' → 'npm' via ||
            // NOT setting command → getInput returns '' → 'npm ci' via ||
            // NOT setting lockfilePath → getInput returns '' → 'package-lock.json' via ||

            mockExecFile.mockImplementation(
                (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
                    cb(null, 'ok\n', '')
                },
            )

            await import('../index.js')
            expect(mockSetOutput).toHaveBeenCalledWith('cache-hit', true)
        })
    })

    describe('lockfile not found', () => {
        it('should throw when lockfile does not exist', async () => {
            mockIsFeatureAvailable.mockReturnValue(true)
            setInput('packageManager', 'npm')
            setInput('cwd', '/project')
            setInput('lockfilePath', 'package-lock.json')
            // Don't create the lockfile in vol
            vol.fromJSON({
                '/project/package.json': '{"name":"test"}',
            })

            await expect(import('../index.js')).rejects.toThrow(/does not exist/)
        })
    })

    describe('package.json not found', () => {
        it('should throw when package.json does not exist', async () => {
            mockIsFeatureAvailable.mockReturnValue(true)
            setInput('packageManager', 'npm')
            setInput('cwd', '/project')
            setInput('lockfilePath', 'package-lock.json')
            setInput('packageJsonPath', 'package.json')
            vol.fromJSON({
                '/project/package-lock.json': JSON.stringify({ lockfileVersion: 3, packages: {} }),
                // package.json NOT created — should cause the access check to throw
            })

            await expect(import('../index.js')).rejects.toThrow(/does not exist/)
        })
    })

    describe('cache hit', () => {
        it('should restore cache and not save when cache hit (npm)', async () => {
            mockIsFeatureAvailable.mockReturnValue(true)
            const exactCacheKey = 'my-fixed-cache-key'
            mockRestoreCache.mockResolvedValue(exactCacheKey)
            setupFiles('npm', '/project/package-lock.json')
            setInput('packageManager', 'npm')
            setInput('cwd', '/project')
            setInput('cacheKey', exactCacheKey) // No variables → exact match
            setInput('command', 'npm ci')

            mockExecFile.mockImplementation(
                (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
                    cb(null, 'ok\n', '')
                },
            )

            await import('../index.js')

            expect(mockRestoreCache).toHaveBeenCalled()
            expect(mockSaveCache).not.toHaveBeenCalled()
            expect(mockSaveState).toHaveBeenCalledWith('cacheKey', exactCacheKey)
            expect(mockSetOutput).toHaveBeenCalledWith('cache-hit', true)
        })
    })

    describe('explicit command and lockfilePath override', () => {
        it('should use explicit command when provided (override PM default)', async () => {
            mockIsFeatureAvailable.mockReturnValue(true)
            mockRestoreCache.mockResolvedValue(undefined)
            mockSaveCache.mockResolvedValue(999)
            setupFiles('npm', '/project/package-lock.json')
            setInput('packageManager', 'npm')
            setInput('cwd', '/project')
            setInput('cacheKey', 'key')
            setInput('command', 'npm install') // explicit — overrides "npm ci" default
            setInput('lockfilePath', 'custom-lock.json') // explicit override

            // Create the custom lockfile
            vol.fromJSON({
                '/project/custom-lock.json': JSON.stringify({ lockfileVersion: 3, packages: {} }),
            })

            mockExecFile.mockImplementation(
                (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
                    cb(null, 'ok\n', '')
                    return { stdout: { pipe: vi.fn() }, stderr: { pipe: vi.fn() } }
                },
            )

            await import('../index.js')
            expect(mockSaveCache).toHaveBeenCalled()
        })
    })

    describe('cache miss — installs and saves', () => {
        it('should run command and save cache on miss (npm)', async () => {
            mockIsFeatureAvailable.mockReturnValue(true)
            mockRestoreCache.mockResolvedValue(undefined) // cache miss
            mockSaveCache.mockResolvedValue(456)
            setupFiles('npm', '/project/package-lock.json')
            setInput('packageManager', 'npm')
            setInput('cwd', '/project')
            setInput('command', '') // derive npm ci
            setInput('cacheKey', 'test-key')

            let commandCb: Function | undefined
            mockExecFile.mockImplementation(
                (cmd: string, _args: string[], _opts: unknown, cb: Function) => {
                    if (cmd === 'node' && mockExecFile.mock.calls.filter((c: unknown[]) => (c as string[])[0] === 'node').length <= 3) {
                        cb(null, 'linux\n', '')
                    } else if (cmd === 'npm') {
                        cb(null, 'ok\n', '')
                    } else {
                        cb(null, 'success\n', '')
                    }
                    return { stdout: { pipe: vi.fn() }, stderr: { pipe: vi.fn() } }
                },
            )

            await import('../index.js')

            // saveCache should have been called since restoreCache returned undefined
            expect(mockSaveCache).toHaveBeenCalled()
            expect(mockSetOutput).toHaveBeenCalledWith('cache-hit', false)
        })
    })

    describe('outputs', () => {
        it('should handle cacheKey with no magic variables', async () => {
            mockIsFeatureAvailable.mockReturnValue(true)
            mockRestoreCache.mockResolvedValue('plain-key')
            setupFiles('npm', '/project/package-lock.json')
            setInput('packageManager', 'npm')
            setInput('cwd', '/project')
            setInput('cacheKey', 'plain-key') // no {VARIABLE} patterns
            setInput('command', 'npm ci')

            mockExecFile.mockImplementation(
                (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
                    cb(null, 'ok\n', '')
                },
            )

            await import('../index.js')

            expect(mockSetOutput).toHaveBeenCalledWith('cacheKey', 'plain-key')
            expect(mockSetOutput).toHaveBeenCalledWith('cache-hit', true)
            expect(mockSetOutput).toHaveBeenCalledWith('variables', '{}')
        })

        it('should skip unknown variables in cacheKey', async () => {
            mockIsFeatureAvailable.mockReturnValue(true)
            mockRestoreCache.mockResolvedValue('result-key')
            setupFiles('npm', '/project/package-lock.json')
            setInput('packageManager', 'npm')
            setInput('cwd', '/project')
            setInput('cacheKey', '{UNKNOWN_VAR}-{OS_NAME}-rest')
            setInput('command', 'npm ci')

            let spawnCount = 0
            mockExecFile.mockImplementation(
                (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
                    spawnCount++
                    // OS_NAME → needs process.platform
                    if (spawnCount === 1 && _cmd === 'node' && _args[0]?.includes('process.platform')) {
                        cb(null, 'linux\n', '')
                    } else {
                        cb(null, 'ok\n', '')
                    }
                    return { stdout: { pipe: vi.fn() }, stderr: { pipe: vi.fn() } }
                },
            )

            await import('../index.js')

            // UNKNOWN_VAR should be skipped, OS_NAME should be replaced
            expect(mockSetOutput).toHaveBeenCalledWith('cacheKey', '{UNKNOWN_VAR}-linux-rest')
            expect(mockSetOutput).toHaveBeenCalledWith('cache-hit', false)
        })

        it('should set cacheKey, variables, and cache-hit outputs', async () => {
            mockIsFeatureAvailable.mockReturnValue(true)
            mockRestoreCache.mockResolvedValue(undefined)
            mockSaveCache.mockResolvedValue(789)
            setupFiles('npm', '/project/package-lock.json')
            setInput('packageManager', 'npm')
            setInput('cwd', '/project')
            setInput('cacheKey', 'my-key-{OS_NAME}')
            setInput('command', 'npm ci')

            let spawnCount = 0
            mockExecFile.mockImplementation(
                (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
                    spawnCount++
                    if (_cmd === 'node' && spawnCount === 1) {
                        cb(null, 'linux\n', '')
                    } else if (_cmd === 'node' && spawnCount === 2) {
                        cb(null, 'x64\n', '')
                    } else if (_cmd === 'node' && spawnCount === 3) {
                        cb(null, 'v20.10.0\n', '')
                    } else {
                        cb(null, 'ok\n', '')
                    }
                    return { stdout: { pipe: vi.fn() }, stderr: { pipe: vi.fn() } }
                },
            )

            await import('../index.js')

            expect(mockSetOutput).toHaveBeenCalledWith('cacheKey', 'my-key-linux')
            expect(mockSetOutput).toHaveBeenCalledWith('variables', expect.any(String))
            expect(mockSetOutput).toHaveBeenCalledWith('cache-hit', false)
        })
    })

    describe('PM variable replacement ordering (fix for plan 7.1)', () => {
        it('should default networkErrorRetryTime to 3 for non-numeric input', async () => {
            mockIsFeatureAvailable.mockReturnValue(true)
            mockRestoreCache.mockResolvedValue('exact-key')
            setupFiles('npm', '/project/package-lock.json')
            setInput('packageManager', 'npm')
            setInput('cwd', '/project')
            setInput('cacheKey', 'exact-key')
            setInput('command', 'npm ci')
            setInput('networkErrorRetryTime', 'abc') // non-numeric → should default to "3"

            mockExecFile.mockImplementation(
                (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
                    cb(null, 'ok\n', '')
                },
            )

            await import('../index.js')

            expect(mockSetOutput).toHaveBeenCalledWith('cache-hit', true)
        })

        it('should accept numeric networkErrorRetryTime', async () => {
            mockIsFeatureAvailable.mockReturnValue(true)
            mockRestoreCache.mockResolvedValue('exact-key-2')
            setupFiles('npm', '/project/package-lock.json')
            setInput('packageManager', 'npm')
            setInput('cwd', '/project')
            setInput('cacheKey', 'exact-key-2')
            setInput('command', 'npm ci')
            setInput('networkErrorRetryTime', '5') // numeric → used as-is

            mockExecFile.mockImplementation(
                (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
                    cb(null, 'ok\n', '')
                },
            )

            await import('../index.js')

            expect(mockSetOutput).toHaveBeenCalledWith('cache-hit', true)
        })

        it('should replace {PM_VERSION_MAJOR} before {PM} to avoid substring collision', async () => {
            mockIsFeatureAvailable.mockReturnValue(true)
            mockRestoreCache.mockResolvedValue(undefined)
            mockSaveCache.mockResolvedValue(999)
            setupFiles('npm', '/project/package-lock.json')
            setInput('packageManager', 'npm')
            setInput('cwd', '/project')
            // Key contains both {PM} and {PM_VERSION_MAJOR} — PM is a substring
            setInput('cacheKey', '{PM}@{PM_VERSION_MAJOR}:rest')
            setInput('command', 'npm ci')

            const spawnResults: Record<string, string> = {
                'node --eval="console.info(process.platform)"': 'linux',
                'node --eval="console.info(process.arch)"': 'x64',
                'node --version': 'v20.10.0',
                'npm --version': '10.5.0',
                'npm ci': 'installed',
            }

            mockExecFile.mockImplementation(
                (cmd: string, args: string[], _opts: unknown, cb: Function) => {
                    const fullCmd = [cmd, ...args].join(' ')
                    if (spawnResults[fullCmd] !== undefined) {
                        cb(null, spawnResults[fullCmd] + '\n', '')
                    } else {
                        cb(null, '', '')
                    }
                    return { stdout: { pipe: vi.fn() }, stderr: { pipe: vi.fn() } }
                },
            )

            await import('../index.js')

            // If PM was replaced first, PM_VERSION_MAJOR would contain "npm" prefix
            expect(mockSetOutput).toHaveBeenCalledWith('cacheKey', 'npm@10:rest')
        })

        it('should replace {LOCKFILE} based on packageManager', async () => {
            mockIsFeatureAvailable.mockReturnValue(true)
            mockRestoreCache.mockResolvedValue(undefined)
            mockSaveCache.mockResolvedValue(999)
            setupFiles('npm', '/project/package-lock.json')
            setInput('packageManager', 'npm')
            setInput('cwd', '/project')
            // Use {LOCKFILE} without git commit variables to avoid octokit mock issues
            setInput('cacheKey', '{LOCKFILE}:rest')
            setInput('command', 'npm ci')

            const spawnResults: Record<string, string> = {
                'npm ci': 'installed',
            }

            mockExecFile.mockImplementation(
                (cmd: string, args: string[], _opts: unknown, cb: Function) => {
                    const fullCmd = [cmd, ...args].join(' ')
                    if (spawnResults[fullCmd] !== undefined) {
                        cb(null, spawnResults[fullCmd] + '\n', '')
                    } else {
                        cb(null, '', '')
                    }
                    return { stdout: { pipe: vi.fn() }, stderr: { pipe: vi.fn() } }
                },
            )

            await import('../index.js')

            // LOCKFILE should be "package-lock" for npm
            expect(mockSetOutput).toHaveBeenCalledWith('cacheKey', 'package-lock:rest')
            expect(mockSetOutput).toHaveBeenCalledWith('cache-hit', false)
        })
    })
})
