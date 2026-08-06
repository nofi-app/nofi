import { describe, expect, it } from 'vitest'
import { parseImport } from './export'

describe('parseImport', () => {
  it('rejects a non-Nofi file', () => {
    expect(() => parseImport('{"app":"other"}')).toThrow(
      'Not a Nofi export file',
    )
  })

  it('rejects invalid JSON', () => {
    expect(() => parseImport('not json')).toThrow()
  })

  it('re-links tags and folders with fresh ids', () => {
    const text = JSON.stringify({
      app: 'nofi',
      version: 1,
      notes: [
        {
          id: 'note-1',
          type: 'note',
          title: 'A',
          text: 'body',
          editor: 'plain',
          tags: ['tag-1'],
          folderId: 'folder-1',
          pinned: false,
          archived: false,
          trashed: false,
          deleted: false,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      tags: [{ id: 'tag-1', type: 'tag', name: 'work' }],
      folders: [{ id: 'folder-1', type: 'folder', name: 'Pharma', parentId: null }],
    })

    const data = parseImport(text)
    expect(data.notes).toHaveLength(1)
    expect(data.tags).toHaveLength(1)
    expect(data.folders).toHaveLength(1)

    const note = data.notes[0]
    expect(note.id).not.toBe('note-1')
    expect(note.tags[0]).toBe(data.tags[0].id)
    expect(note.folderId).toBe(data.folders[0].id)
    expect(data.folders[0].parentId).toBeNull()
  })

  it('preserves folder parent links', () => {
    const text = JSON.stringify({
      app: 'nofi',
      version: 1,
      notes: [],
      tags: [],
      folders: [
        { id: 'child', type: 'folder', name: 'Child', parentId: 'root' },
        { id: 'root', type: 'folder', name: 'Root', parentId: null },
      ],
    })

    const data = parseImport(text)
    const root = data.folders.find((f) => f.name === 'Root')!
    const child = data.folders.find((f) => f.name === 'Child')!
    expect(child.parentId).toBe(root.id)
  })
})
