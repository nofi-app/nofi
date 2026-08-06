import type { Item, NoteEditorType, NoteItem } from './types'

export function createNote(): NoteItem {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    type: 'note',
    editor: 'plain',
    title: '',
    text: '',
    tags: [],
    folderId: null,
    pinned: false,
    archived: false,
    trashed: false,
    deleted: false,
    createdAt: now,
    updatedAt: now,
  }
}

export function isNote(item: Item): item is NoteItem {
  return item.type === 'note'
}

export function editorLabel(editor: NoteEditorType): string {
  switch (editor) {
    case 'plain':
      return 'Plain text'
    case 'markdown':
      return 'Markdown'
    case 'rich':
      return 'Rich text'
    case 'code':
      return 'Code'
    case 'checklist':
      return 'Checklist'
  }
}
