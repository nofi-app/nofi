import { describe, expect, it } from 'vitest'
import { isConflicting, makeConflictCopy } from './sync'
import type { NoteItem } from './types'
import type { StoredRow } from './items'

function note(updatedAt: number, title = 'Title'): NoteItem {
  return {
    id: 'note-1',
    type: 'note',
    editor: 'plain',
    title,
    text: 'body',
    tags: [],
    folderId: null,
    pinned: false,
    archived: false,
    trashed: false,
    locked: false,
    deleted: false,
    createdAt: 1,
    updatedAt,
  }
}

function row(updatedAt: number): StoredRow {
  return {
    id: 'note-1',
    user_id: 'user',
    content_type: 'note',
    encrypted_content: '{}',
    deleted: false,
    created_at: new Date(1).toISOString(),
    updated_at: new Date(updatedAt).toISOString(),
  }
}

describe('isConflicting', () => {
  it('detects a server version newer than a queued local edit', () => {
    expect(isConflicting(row(2000), note(1000))).toBe(true)
  })

  it('does not conflict when the local edit is newer', () => {
    expect(isConflicting(row(1000), note(2000))).toBe(false)
  })

  it('does not conflict on identical timestamps', () => {
    expect(isConflicting(row(1000), note(1000))).toBe(false)
  })
})

describe('makeConflictCopy', () => {
  it('creates a new note id and marks it as a conflicted copy', () => {
    const copy = makeConflictCopy(note(1000)) as NoteItem
    expect(copy.id).not.toBe('note-1')
    expect(copy.title).toContain('(conflicted copy)')
    expect(copy.type).toBe('note')
  })

  it('preserves the body and flags a blank title', () => {
    const copy = makeConflictCopy(note(1000, '')) as NoteItem
    expect(copy.title).toContain('Untitled')
    expect(copy.text).toBe('body')
    expect(copy.deleted).toBe(false)
  })

  it('passes non-note items through unchanged', () => {
    const tag = {
      id: 'tag-1',
      type: 'tag',
      name: 'x',
      deleted: false,
      createdAt: 1,
      updatedAt: 1,
    } as unknown as Parameters<typeof makeConflictCopy>[0]
    expect(makeConflictCopy(tag).id).toBe('tag-1')
  })
})
