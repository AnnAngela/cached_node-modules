import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { vol, fs as memfs } from 'memfs'

vi.mock('node:fs', () => ({
    default: memfs,
}))
vi.mock('node:fs/promises', () => ({
    default: memfs.promises,
    ...memfs.promises,
}))

// Mock dependencies for mkdtmp and jsonModule used by lockfileHandler
vi.mock('node:os', () => ({
    tmpdir: () => '/tmp',
}))
vi.mock('node:crypto', () => ({
    randomUUID: () => 'test-uuid',
}))

import {
    packageLockHandler,
    pnpmLockHandler,
    yarnClassicLockHandler,
    yarnBerryLockHandler,
} from '../lockfileHandler.js'
// Note: these exports may not exist yet — they will be added in the implementation phase

beforeEach(() => {
    vi.unstubAllEnvs()
    vol.reset()
    vi.stubEnv('RUNNER_TEMP', '/tmp/_runner_temp')
})

describe('packageLockHandler (npm)', () => {
    beforeAll(() => {
        // Ensure handler exists (it will once implemented)
    })

    it('should strip name, version, and requires from package-lock.json v3', async () => {
        const lockfileV3 = JSON.stringify({
            name: 'my-project',
            version: '1.0.0',
            lockfileVersion: 3,
            requires: true,
            packages: {
                '': {
                    name: 'my-project',
                    version: '1.0.0',
                },
                'node_modules/express': {
                    version: '4.18.2',
                    resolved: 'https://registry.npmjs.org/express/-/express-4.18.2.tgz',
                    integrity: 'sha512-abc123...',
                },
            },
        })

        vol.fromJSON({
            '/project/package-lock.json': lockfileV3,
        })

        const { lockfileContent } = await packageLockHandler(
            '/project/package-lock.json',
            { base: 'package-lock.json', name: 'package-lock', ext: '.json', dir: '/project', root: '' },
        )

        const parsed = JSON.parse(lockfileContent)
        // Non-essential keys should be stripped
        expect(parsed).not.toHaveProperty('name')
        expect(parsed).not.toHaveProperty('version')
        expect(parsed).not.toHaveProperty('requires')
        // Essential keys should be kept
        expect(parsed).toHaveProperty('lockfileVersion', 3)
        expect(parsed).toHaveProperty('packages')
    })

    it('should produce deterministic output — same input same output', async () => {
        const lockfileV3 = JSON.stringify({
            lockfileVersion: 3,
            packages: {
                'node_modules/foo': { version: '1.0.0' },
            },
        })

        vol.fromJSON({
            '/project/packagelock.json': lockfileV3,
        })

        const r1 = await packageLockHandler(
            '/project/packagelock.json',
            { base: 'packagelock.json', name: 'packagelock', ext: '.json', dir: '/project', root: '' },
        )
        const r2 = await packageLockHandler(
            '/project/packagelock.json',
            { base: 'packagelock.json', name: 'packagelock', ext: '.json', dir: '/project', root: '' },
        )

        expect(r1.lockfileContent).toBe(r2.lockfileContent)
    })

    it('should produce different output when packages change', async () => {
        const v1 = JSON.stringify({
            lockfileVersion: 3,
            packages: { 'node_modules/foo': { version: '1.0.0' } },
        })
        const v2 = JSON.stringify({
            lockfileVersion: 3,
            packages: { 'node_modules/foo': { version: '2.0.0' } },
        })

        vol.fromJSON({
            '/p1/package-lock.json': v1,
            '/p2/package-lock.json': v2,
        })

        const r1 = await packageLockHandler(
            '/p1/package-lock.json',
            { base: 'package-lock.json', name: 'package-lock', ext: '.json', dir: '/p1', root: '' },
        )
        const r2 = await packageLockHandler(
            '/p2/package-lock.json',
            { base: 'package-lock.json', name: 'package-lock', ext: '.json', dir: '/p2', root: '' },
        )

        expect(r1.lockfileContent).not.toBe(r2.lockfileContent)
    })

    it('should handle package-lock.json without packages field', async () => {
        const lockfile = JSON.stringify({ lockfileVersion: 3 })
        vol.fromJSON({ '/project/package-lock.json': lockfile })
        const { lockfileContent } = await packageLockHandler(
            '/project/package-lock.json',
            { base: 'package-lock.json', name: 'package-lock', ext: '.json', dir: '/project', root: '' },
        )
        const parsed = JSON.parse(lockfileContent)
        expect(parsed).toHaveProperty('lockfileVersion', 3)
        expect(parsed).not.toHaveProperty('packages')
    })
})

describe('pnpmLockHandler', () => {
    it('should strip snapshots and time fields, keep lockfileVersion, importers, packages', async () => {
        const pnpmLockfile = `lockfileVersion: '9.0'

importers:
  .:
    dependencies:
      express:
        specifier: ^4.18.0
        version: 4.18.2

packages:
  /express/4.18.2:
    resolution:
      integrity: sha512-abc123

snapshots:
  express@4.18.2:
    dependencies:
      accepts: 1.3.8

time:
  /express/4.18.2: '2024-01-01T00:00:00.000Z'
`

        vol.fromJSON({
            '/project/pnpm-lock.yaml': pnpmLockfile,
        })

        const { lockfileContent } = await pnpmLockHandler(
            '/project/pnpm-lock.yaml',
            { base: 'pnpm-lock.yaml', name: 'pnpm-lock', ext: '.yaml', dir: '/project', root: '' },
        )

        // Parse output as YAML to verify structure
        const { default: YAML } = await import('yaml')
        const parsed = YAML.parse(lockfileContent)

        expect(parsed).toHaveProperty('lockfileVersion', '9.0')
        expect(parsed).toHaveProperty('importers')
        expect(parsed).toHaveProperty('packages')
        expect(parsed).not.toHaveProperty('snapshots')
        expect(parsed).not.toHaveProperty('time')
    })

    it('should produce deterministic output', async () => {
        const pnpmLockfile = `lockfileVersion: '6.0'

importers:
  .:
    dependencies:
      foo:
        specifier: ^1.0.0
        version: 1.0.0

packages:
  /foo/1.0.0:
    resolution:
      integrity: sha512-xyz

snapshots:
  foo@1.0.0: {}
`

        vol.fromJSON({
            '/project/pnpm-lock.yaml': pnpmLockfile,
        })

        const r1 = await pnpmLockHandler(
            '/project/pnpm-lock.yaml',
            { base: 'pnpm-lock.yaml', name: 'pnpm-lock', ext: '.yaml', dir: '/project', root: '' },
        )
        const r2 = await pnpmLockHandler(
            '/project/pnpm-lock.yaml',
            { base: 'pnpm-lock.yaml', name: 'pnpm-lock', ext: '.yaml', dir: '/project', root: '' },
        )

        expect(r1.lockfileContent).toBe(r2.lockfileContent)
    })
})

describe('yarnClassicLockHandler', () => {
    const classicParsedPath = { base: 'yarn.lock', name: 'yarn', ext: '.lock', dir: '/project', root: '' }

    it('should strip the header comments, keep package entries', async () => {
        const classicLockfile = `# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
# yarn lockfile v1

package-1@^1.0.0:
  version "1.0.3"
  resolved "https://registry.yarnpkg.com/..."
  integrity sha512-abc

package-2@^2.0.0:
  version "2.0.1"
  resolved "https://registry.yarnpkg.com/..."
  dependencies:
    package-4 "^4.0.0"
`

        vol.fromJSON({
            '/project/yarn.lock': classicLockfile,
        })

        const { lockfileContent } = await yarnClassicLockHandler('/project/yarn.lock', classicParsedPath)

        // Header comments should be removed
        expect(lockfileContent).not.toContain('# yarn lockfile v1')
        expect(lockfileContent).not.toContain('AUTOGENERATED')
        // Package entries should be kept
        expect(lockfileContent).toContain('package-1@^1.0.0')
        expect(lockfileContent).toContain('version "1.0.3"')
        expect(lockfileContent).toContain('package-2@^2.0.0')
        expect(lockfileContent).toContain('package-4 "^4.0.0"')
    })

    it('should produce deterministic output', async () => {
        vol.fromJSON({
            '/project/yarn.lock': `# yarn lockfile v1
foo@^1.0.0:
  version "1.0.0"
`,
        })

        const r1 = await yarnClassicLockHandler('/project/yarn.lock', classicParsedPath)
        const r2 = await yarnClassicLockHandler('/project/yarn.lock', classicParsedPath)

        expect(r1.lockfileContent).toBe(r2.lockfileContent)
    })
})

describe('yarnBerryLockHandler', () => {
    const berryParsedPath = { base: 'yarn.lock', name: 'yarn', ext: '.lock', dir: '/project', root: '' }

    it('should strip __metadata and header comment, keep package entries', async () => {
        const berryLockfile = `# This file is generated by running "yarn install" inside your project.
# Manual changes might be lost - proceed with caution!

__metadata:
  version: 10
  cacheKey: 10

"@actions/core@npm:^1.2.6":
  version: 1.2.6
  resolution: "@actions/core@npm:1.2.6"
  checksum: 10/713ec86f...
  languageName: node
  linkType: hard
`

        vol.fromJSON({
            '/project/yarn.lock': berryLockfile,
        })

        const { lockfileContent } = await yarnBerryLockHandler('/project/yarn.lock', berryParsedPath)

        const { default: YAML } = await import('yaml')
        const parsed = YAML.parse(lockfileContent)

        expect(parsed).not.toHaveProperty('__metadata')
        expect(parsed).toHaveProperty('@actions/core@npm:^1.2.6')
        expect(parsed['@actions/core@npm:^1.2.6']).toHaveProperty('version', '1.2.6')
        expect(lockfileContent).not.toContain('# This file is generated')
    })

    it('should produce deterministic output', async () => {
        vol.fromJSON({
            '/project/yarn.lock': `__metadata:
  version: 6
  cacheKey: 8
foo@npm:^1.0.0:
  version: 1.0.0
  languageName: node
  linkType: hard
`,
        })

        const r1 = await yarnBerryLockHandler('/project/yarn.lock', berryParsedPath)
        const r2 = await yarnBerryLockHandler('/project/yarn.lock', berryParsedPath)

        expect(r1.lockfileContent).toBe(r2.lockfileContent)
    })

    describe('yarnBerryLockHandler error cases', () => {
        it('should throw when YAML parses to a non-object', async () => {
            vol.fromJSON({ '/project/yarn.lock': '123' })
            await expect(
                yarnBerryLockHandler('/project/yarn.lock', berryParsedPath),
            ).rejects.toThrow('expected an object')
        })

        it('should throw when YAML parse fails', async () => {
            vol.fromJSON({ '/project/yarn.lock': '{{{broken: }}:' })
            await expect(
                yarnBerryLockHandler('/project/yarn.lock', berryParsedPath),
            ).rejects.toThrow('Failed to parse yarn.lock')
        })
    })

    describe('pnpmLockHandler error cases', () => {
        it('should throw when YAML parses to a non-object', async () => {
            vol.fromJSON({ '/project/pnpm-lock.yaml': '42' })
            await expect(
                pnpmLockHandler('/project/pnpm-lock.yaml', { base: 'pnpm-lock.yaml', name: 'pnpm-lock', ext: '.yaml', dir: '/project', root: '' }),
            ).rejects.toThrow('expected an object')
        })

        it('should throw when YAML parse fails completely', async () => {
            vol.fromJSON({ '/project/pnpm-lock.yaml': '{{{invalid' })
            await expect(
                pnpmLockHandler('/project/pnpm-lock.yaml', { base: 'pnpm-lock.yaml', name: 'pnpm-lock', ext: '.yaml', dir: '/project', root: '' }),
            ).rejects.toThrow('Failed to parse pnpm-lock.yaml')
        })
    })
})
