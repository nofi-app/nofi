import { describe, expect, it } from 'vitest'
import { folderPath } from './folders'

const folders = [
  {
    id: 'a',
    type: 'folder' as const,
    name: 'Work',
    parentId: null,
    deleted: false,
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: 'b',
    type: 'folder' as const,
    name: 'Projects',
    parentId: 'a',
    deleted: false,
    createdAt: 1,
    updatedAt: 1,
  },
]

describe('folderPath', () => {
  it('returns the full nested path', () => {
    expect(folderPath(folders, 'b')).toBe('Work / Projects')
  })

  it('handles a root folder', () => {
    expect(folderPath(folders, 'a')).toBe('Work')
  })

  it('returns "No folder" for null', () => {
    expect(folderPath(folders, null)).toBe('No folder')
  })
})
