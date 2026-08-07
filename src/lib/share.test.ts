import { describe, expect, it } from 'vitest'
import { buildShareLink, parseShareUrl } from './share'

describe('share link building', () => {
  it('builds a link that round-trips through parseShareUrl', () => {
    const link = buildShareLink('abc123', 'aWFtYQ==', 'https://nofi.pages.dev')
    const parsed = parseShareUrl(link)
    expect(parsed).toEqual({ token: 'abc123', keyB64: 'aWFtYQ==' })
  })

  it('parses token and key from a share url', () => {
    const parsed = parseShareUrl('https://nofi.pages.dev/?share=tokenXYZ#key=c2VjcmV0')
    expect(parsed).toEqual({ token: 'tokenXYZ', keyB64: 'c2VjcmV0' })
  })

  it('returns null when no share params are present', () => {
    expect(parseShareUrl('https://nofi.pages.dev/')).toBeNull()
  })

  it('returns null when the key fragment is missing', () => {
    expect(parseShareUrl('https://nofi.pages.dev/?share=tokenXYZ')).toBeNull()
  })
})
