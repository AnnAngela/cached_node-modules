import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fs as memfs, vol } from 'memfs'

vi.mock('node:fs', () => ({
    default: memfs,
}))
vi.mock('node:fs/promises', () => ({
    default: memfs.promises,
    ...memfs.promises,
}))

beforeEach(() => {
    vol.reset()
})

// Must import after mocks are set up
const { readFile, writeFile } = await import('../jsonModule.js')

describe('readFile', () => {
    it('should read and parse a JSON file', async () => {
        vol.fromJSON({
            '/test.json': JSON.stringify({ name: 'test', version: '1.0.0' }),
        })

        const result = await readFile('/test.json')
        expect(result).toEqual({ name: 'test', version: '1.0.0' })
    })

    it('should parse arrays', async () => {
        vol.fromJSON({
            '/arr.json': JSON.stringify([1, 2, 3]),
        })

        const result = await readFile('/arr.json')
        expect(result).toEqual([1, 2, 3])
    })

    it('should parse nested objects', async () => {
        const data = { a: { b: { c: 1 } } }
        vol.fromJSON({
            '/nested.json': JSON.stringify(data),
        })

        const result = await readFile('/nested.json')
        expect(result).toEqual(data)
    })
})

describe('writeFile', () => {
    it('should write JSON with default 4-space indent', async () => {
        await writeFile('/out.json', { name: 'test' })

        const raw = memfs.promises.readFile('/out.json', 'utf-8')
        expect(await raw).toBe('{\n    "name": "test"\n}\n')
    })

    it('should write JSON with custom indent', async () => {
        await writeFile('/out.json', { name: 'test' }, 2)

        const raw = memfs.promises.readFile('/out.json', 'utf-8')
        expect(await raw).toBe('{\n  "name": "test"\n}\n')
    })

    it('should write arrays correctly', async () => {
        await writeFile('/out.json', [1, 2, 3])

        const raw = memfs.promises.readFile('/out.json', 'utf-8')
        expect(await raw).toBe('[\n    1,\n    2,\n    3\n]\n')
    })
})
