import type { NoteEditorType, NoteItem } from './types'

export interface Template {
  id: string
  name: string
  editor: NoteEditorType
  text: string
}

const STORAGE_KEY = 'nofi:templates'

export const BUILTIN_TEMPLATES: Template[] = [
  { id: 'blank', name: 'Blank note', editor: 'plain', text: '' },
  {
    id: 'daily',
    name: 'Daily note',
    editor: 'plain',
    text: '## Daily note\n\n### Today\n\n\n### Notes\n\n',
  },
  {
    id: 'meeting',
    name: 'Meeting notes',
    editor: 'plain',
    text: '# Meeting\n\nDate:\n\nAttendees:\n\n## Agenda\n- \n\n## Decisions\n- \n\n## Action items\n- [ ] ',
  },
  { id: 'todo', name: 'To-do list', editor: 'checklist', text: '- [ ] ' },
  {
    id: 'recipe',
    name: 'Recipe',
    editor: 'markdown',
    text: '# Recipe\n\n## Ingredients\n- \n\n## Steps\n1. ',
  },
  { id: 'journal', name: 'Journal', editor: 'plain', text: '## Date\n\n' },
]

export function getUserTemplates(): Template[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Template[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveUserTemplate(note: NoteItem): Template {
  const tpl: Template = {
    id: crypto.randomUUID(),
    name: note.title.trim() || 'Untitled template',
    editor: note.editor,
    text: note.text,
  }
  const current = getUserTemplates()
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...current, tpl]))
  return tpl
}

export function removeUserTemplate(id: string) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(getUserTemplates().filter((t) => t.id !== id)),
  )
}

export function allTemplates(): Template[] {
  return [...getUserTemplates(), ...BUILTIN_TEMPLATES]
}
