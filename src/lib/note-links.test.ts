import { describe, expect, it } from 'vitest'
import {
  detectLinkSuggest,
  filterSuggestions,
  findBacklinks,
  findNoteLinks,
  noteRefs,
} from './note-links'
import type { NoteItem } from './types'

function note(id: string, title: string, text: string): NoteItem {
  return {
    id,
    type: 'note',
    title,
    text,
    editor: 'plain',
    tags: [],
    folderId: null,
    pinned: false,
    archived: false,
    trashed: false,
    locked: false,
    createdAt: 1,
    updatedAt: 1,
  }
}

describe('findNoteLinks', () => {
  it('extracts unique linked titles', () => {
    expect(findNoteLinks('See [[Shopping]] and [[Ideas]].')).toEqual([
      'Shopping',
      'Ideas',
    ])
  })

  it('returns an empty array when there are no links', () => {
    expect(findNoteLinks('Nothing linked here.')).toEqual([])
  })
})

describe('findBacklinks', () => {
  const notes = [
    note('a', 'Shopping', 'Buy milk'),
    note('b', 'Ideas', 'Related: [[Shopping]]'),
    note('c', 'Other', 'No links'),
  ]

  it('finds notes that reference the target', () => {
    const backlinks = findBacklinks(notes, { id: 'a', title: 'Shopping' })
    expect(backlinks.map((n) => n.id)).toEqual(['b'])
  })

  it('excludes the note itself', () => {
    const notesWithSelf = [
      ...notes,
      note('d', 'Shopping', 'Refs [[Shopping]] itself'),
    ]
    expect(
      findBacklinks(notesWithSelf, { id: 'd', title: 'Shopping' }).map((n) => n.id),
    ).toEqual(['b'])
  })
})

describe('noteRefs', () => {
  it('omits trashed and untitled notes', () => {
    const notes = [
      note('a', 'Keep', 'x'),
      note('b', 'Gone', 'x'),
      note('c', '', 'x'),
    ]
    notes[1].trashed = true
    expect(noteRefs(notes)).toEqual([{ id: 'a', title: 'Keep' }])
  })
})

describe('detectLinkSuggest', () => {
  it('detects an open link trigger', () => {
    expect(detectLinkSuggest('Hello [[Sho', 'pping')).toEqual({
      open: true,
      query: 'Sho',
    })
  })

  it('does not trigger when the link is closed', () => {
    expect(detectLinkSuggest('Hello [[Done]]')).toEqual({
      open: false,
      query: '',
    })
  })

  it('does not trigger across lines', () => {
    expect(detectLinkSuggest('Hello [[\nSho')).toEqual({
      open: false,
      query: '',
    })
  })
})

describe('filterSuggestions', () => {
  const refs = [
    { id: 'a', title: 'Shopping list' },
    { id: 'b', title: 'Ideas' },
    { id: 'c', title: 'Shop plans' },
  ]

  it('matches titles by query', () => {
    expect(filterSuggestions(refs, 'shop', '')).toEqual([
      { id: 'a', title: 'Shopping list' },
      { id: 'c', title: 'Shop plans' },
    ])
  })

  it('excludes the current note and returns all when no query', () => {
    expect(filterSuggestions(refs, '', 'a').map((r) => r.id)).toEqual(['b', 'c'])
  })
})
