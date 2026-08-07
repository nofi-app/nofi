import { useMemo } from 'react'
import type { NoteEditorType } from '../lib/types'

interface EditorStatsProps {
  text: string
  editor: NoteEditorType
}

export function EditorStats({ text, editor }: EditorStatsProps) {
  const stats = useMemo(() => {
    const plain =
      editor === 'rich'
        ? text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        : text
    const words = plain.split(/\s+/).filter(Boolean).length
    const chars = plain.length
    const reading = words > 0 ? Math.max(1, Math.ceil(words / 200)) : 0
    return { words, chars, reading }
  }, [text, editor])

  return (
    <div className="editor-stats">
      <span>
        {stats.words} word{stats.words === 1 ? '' : 's'}
      </span>
      <span>{stats.chars} chars</span>
      {stats.reading > 0 && <span>{stats.reading} min read</span>}
    </div>
  )
}
