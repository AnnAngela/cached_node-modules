import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'

const mockExecFile = vi.fn()
vi.mock('node:child_process', () => ({
    execFile: mockExecFile,
}))

// Mock shell-quote to return a simple parsed command
vi.mock('shell-quote', () => ({
    default: {
        parse: (cmd: string) => {
            // Simple parsing for test purposes - split by space, filter quotes
            return cmd.split(' ')
        },
    },
}))

// Mock @actions/core for debug
vi.mock('@actions/core', () => ({
    debug: vi.fn(),
}))

// Must be imported after mocks
const execCommand = (await import('./spawnChildProcess.js')).default

describe('spawnChildProcess', () => {
    afterEach(() => {
        mockExecFile.mockReset()
    })

    describe('successful execution', () => {
        it('should return trimmed stdout on success', async () => {
            mockExecFile.mockImplementation(
                (_cmd: string, _args: string[], opts: unknown, cb: Function) => {
                    cb(null, '  hello world  \n', '')
                },
            )

            const result = await execCommand('echo hello', { cwd: '/' })
            expect(result).toBe('hello world')
        })

        it('should pass cwd to execFile options', async () => {
            mockExecFile.mockImplementation(
                (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
                    cb(null, 'ok', '')
                },
            )

            await execCommand('test', { cwd: '/custom/path' })

            expect(mockExecFile).toHaveBeenCalledWith(
                'test',
                [],
                { cwd: '/custom/path' },
                expect.any(Function),
            )
        })
    })

    describe('network error retry', () => {
        it('should retry on ECMONNREFUSED error with npm prefix', async () => {
            let callCount = 0
            mockExecFile.mockImplementation(
                (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
                    callCount++
                    if (callCount === 1) {
                        cb(new Error('command failed'), '', 'npm ERR! code ECONNREFUSED')
                    } else {
                        cb(null, 'success', '')
                    }
                },
            )

            // Need to mock setTimeout to avoid waiting
            vi.useFakeTimers()

            const promise = execCommand('npm install', {
                cwd: '/',
                retryTime: 1,
            })

            // Fast-forward past the 5000ms delay
            await vi.runAllTimersAsync()

            const result = await promise
            expect(result).toBe('success')
            expect(callCount).toBe(2)

            vi.useRealTimers()
        })

        it('should reject when retryTime is 0', async () => {
            mockExecFile.mockImplementation(
                (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
                    cb(new Error('network failed'), '', 'npm ERR! code ETIMEDOUT')
                },
            )

            await expect(
                execCommand('npm install', { cwd: '/', retryTime: 0 }),
            ).rejects.toThrow('network failed')
        })

        it('should retry on yarn classic network error', async () => {
            let callCount = 0
            mockExecFile.mockImplementation(
                (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
                    callCount++
                    if (callCount === 1) {
                        cb(
                            new Error('yarn failed'),
                            '',
                            'info There appears to be trouble with your network connection. Retrying...',
                        )
                    } else {
                        cb(null, 'yarn success', '')
                    }
                },
            )

            vi.useFakeTimers()
            const promise = execCommand('yarn install', { cwd: '/', retryTime: 1 })
            await vi.runAllTimersAsync()
            const result = await promise
            expect(result).toBe('yarn success')
            vi.useRealTimers()
        })

        it('should reject on non-network error without retry', async () => {
            mockExecFile.mockImplementation(
                (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
                    cb(new Error('EACCES: permission denied'), '', 'EACCES: permission denied, mkdir')
                },
            )

            await expect(
                execCommand('some-cmd', { cwd: '/' }),
            ).rejects.toThrow('EACCES: permission denied')
        })
    })

    describe('stdout/stderr piping', () => {
        it('should pipe stdout when synchronousStdout is true', () => {
            const mockPipe = vi.fn()
            const mockStdout = new EventEmitter()
            mockStdout.pipe = mockPipe
            const mockStderr = new EventEmitter()
            const mockChild = {
                stdout: mockStdout,
                stderr: mockStderr,
            }

            mockExecFile.mockReturnValue(mockChild)

            execCommand('test', { cwd: '/', synchronousStdout: true })

            expect(mockPipe).toHaveBeenCalledWith(process.stdout)
        })

        it('should pipe stderr when synchronousStderr is true', () => {
            const mockPipe = vi.fn()
            const mockStdout = new EventEmitter()
            const mockStderr = new EventEmitter()
            mockStderr.pipe = mockPipe
            const mockChild = {
                stdout: mockStdout,
                stderr: mockStderr,
            }

            mockExecFile.mockReturnValue(mockChild)

            execCommand('test', { cwd: '/', synchronousStderr: true })

            expect(mockPipe).toHaveBeenCalledWith(process.stderr)
        })

        it('should not call pipe when synchronousStdout is false', () => {
            const mockPipe = vi.fn()
            const mockStdout = new EventEmitter()
            mockStdout.pipe = mockPipe
            const mockStderr = new EventEmitter()
            const mockChild = {
                stdout: mockStdout,
                stderr: mockStderr,
            }

            mockExecFile.mockReturnValue(mockChild)

            execCommand('test', { cwd: '/' })

            expect(mockPipe).not.toHaveBeenCalled()
        })
    })

    describe('command parsing', () => {
        it('should parse command with arguments', async () => {
            mockExecFile.mockImplementation(
                (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
                    // Access the parsed command and args
                    expect(_cmd).toBe('npm')
                    expect(_args).toEqual(['ci', '--prefer-offline'])
                    cb(null, 'installed', '')
                },
            )

            await execCommand('npm ci --prefer-offline', { cwd: '/' })
        })
    })

    describe('default retryTime', () => {
        it('should default retryTime to 3 when not specified', async () => {
            let callCount = 0
            mockExecFile.mockImplementation(
                (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
                    callCount++
                    if (callCount <= 2) {
                        cb(new Error('fail'), '', 'npm ERR! code ECONNREFUSED')
                    } else {
                        cb(null, 'ok after retries', '')
                    }
                },
            )

            vi.useFakeTimers()
            const promise = execCommand('npm install', { cwd: '/' })
            await vi.runAllTimersAsync()
            await vi.runAllTimersAsync() // Two 5-second delays
            const result = await promise
            expect(result).toBe('ok after retries')
            expect(callCount).toBe(3)
            vi.useRealTimers()
        }, 10000)
    })
})
