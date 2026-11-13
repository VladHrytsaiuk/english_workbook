import { describe, expect, it } from 'vitest'
import { compareVersions, parseRelease } from '@shared/updates'

describe('compareVersions', () => {
  it('compares numerically, not as text', () => {
    expect(compareVersions('1.10.0', '1.9.2')).toBeGreaterThan(0)
    expect(compareVersions('1.8.1', '1.8.1')).toBe(0)
    expect(compareVersions('v1.8.0', '1.8.1')).toBeLessThan(0)
    expect(compareVersions('2.0', '1.99.99')).toBeGreaterThan(0)
  })
})

describe('parseRelease', () => {
  const release = { tag_name: 'v1.9.0', html_url: 'https://github.com/o/r/releases/tag/v1.9.0', body: ' notes ', draft: false, prerelease: false }
  it('reports a newer release', () => {
    expect(parseRelease(release, '1.8.1')).toEqual({ current: '1.8.1', latest: '1.9.0', available: true, url: release.html_url, notes: 'notes' })
  })
  it('is not available when current or newer', () => {
    expect(parseRelease(release, '1.9.0')?.available).toBe(false)
    expect(parseRelease(release, '2.0.0')?.available).toBe(false)
  })
  it('ignores drafts, pre-releases and junk, and non-GitHub links', () => {
    expect(parseRelease({ ...release, draft: true }, '1.0.0')).toBeNull()
    expect(parseRelease({ ...release, prerelease: true }, '1.0.0')).toBeNull()
    expect(parseRelease({ tag_name: 'nightly' }, '1.0.0')).toBeNull()
    expect(parseRelease(null, '1.0.0')).toBeNull()
    expect(parseRelease({ ...release, html_url: 'http://evil.example/x' }, '1.0.0')?.url).toBe('')
  })
})

describe('release configuration', () => {
  it('package.json names the same repository as UPDATE_REPO once it is set', async () => {
    const { UPDATE_REPO } = await import('@shared/updates')
    const pkg = (await import('../package.json')).default as { repository?: { url?: string } }
    if (UPDATE_REPO) expect(pkg.repository?.url).toContain(`github.com/${UPDATE_REPO}`)
    else expect(pkg.repository?.url).toBeTruthy()
  })
})
