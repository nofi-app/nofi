import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import {
  Bold,
  Code,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
  Underline as UnderlineIcon,
} from 'lucide-react'
import { fileRefUrl } from '../../lib/inline-images'
import {
  detectLinkSuggest,
  filterSuggestions,
  type NoteLinkSuggest,
} from '../../lib/note-links'
import { NoteLinkPopup } from '../NoteLinkPopup'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  insertImage?: (file: File) => Promise<string | null>
  resolveImages?: (container: HTMLElement | null) => void
  notes?: { id: string; title: string }[]
  excludeId?: string
}

type EditorInstance = NonNullable<ReturnType<typeof useEditor>>
type EditorRef = { current: EditorInstance | null }

function ToolBtn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={`rich-btn${active ? ' active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  )
}

export function RichTextEditor({
  value,
  onChange,
  insertImage,
  resolveImages,
  notes,
  excludeId,
}: RichTextEditorProps) {
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [suggest, setSuggest] = useState<NoteLinkSuggest>({
    open: false,
    query: '',
  })
  const [suggestIndex, setSuggestIndex] = useState(0)
  const [suggestPos, setSuggestPos] = useState<{ top: number; left: number } | null>(null)
  const editorRef: EditorRef = useRef<EditorInstance | null>(null)

  const options = filterSuggestions(notes ?? [], suggest.query, excludeId ?? '')

  const live = useRef({
    suggest,
    suggestIndex,
    options,
    notes,
    excludeId,
  })
  live.current = { suggest, suggestIndex, options, notes, excludeId }

  function checkSuggest(editor: EditorInstance) {
    const { from } = editor.state.selection
    const before = editor.state.doc.textBetween(
      Math.max(0, from - 60),
      from,
      '\n',
    )
    const after = editor.state.doc.textBetween(
      from,
      Math.min(editor.state.doc.content.size, from + 60),
      '\n',
    )
    const det = detectLinkSuggest(before, after)
    if (det.open) {
      const coords = editor.view.coordsAtPos(from)
      setSuggestPos({ top: coords.bottom + 6, left: coords.left })
      setSuggest({ open: true, query: det.query })
      setSuggestIndex(0)
    } else {
      setSuggest((s) => (s.open ? { open: false, query: '' } : s))
    }
  }

  function insertSuggestion(editor: EditorInstance, opt: { id: string; title: string }) {
    const { from } = editor.state.selection
    const before = editor.state.doc.textBetween(
      Math.max(0, from - 60),
      from,
      '\n',
    )
    const start = before.lastIndexOf('[[')
    if (start === -1) return
    const abs = from - before.length + start
    editor
      .chain()
      .focus()
      .insertContentAt({ from: abs, to: from }, `[[${opt.title}]]`)
      .run()
    setSuggest({ open: false, query: '' })
  }

  function handleKeyDown(
    editor: EditorInstance,
    e: KeyboardEvent,
  ): boolean {
    const cur = live.current
    if (!cur.suggest.open) return false
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSuggestIndex((i) => Math.min(i + 1, cur.options.length - 1))
      return true
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSuggestIndex((i) => Math.max(i - 1, 0))
      return true
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const opt = cur.options[cur.suggestIndex]
      if (opt) insertSuggestion(editor, opt)
      return true
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setSuggest({ open: false, query: '' })
      return true
    }
    return false
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
      }),
      Image.configure({ inline: true }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
      checkSuggest(editor)
    },
    onSelectionUpdate: ({ editor }) => checkSuggest(editor),
    editorProps: {
      attributes: { class: 'note-editor-rich' },
      handlePaste: (_view, event) =>
        handleImageTransfer(event.clipboardData, editorRef, insertImage),
      handleDrop: (_view, event) =>
        handleImageTransfer(event.dataTransfer, editorRef, insertImage),
      handleKeyDown: (_view, event) =>
        editorRef.current ? handleKeyDown(editorRef.current, event) : false,
    },
  })
  editorRef.current = editor

  useEffect(() => {
    if (!editor || !resolveImages) return
    resolveImages(editor.view.dom as HTMLElement)
  })

  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      isBold: editor.isActive('bold'),
      isItalic: editor.isActive('italic'),
      isUnderline: editor.isActive('underline'),
      isStrike: editor.isActive('strike'),
      h1: editor.isActive('heading', { level: 1 }),
      h2: editor.isActive('heading', { level: 2 }),
      h3: editor.isActive('heading', { level: 3 }),
      isBullet: editor.isActive('bulletList'),
      isOrdered: editor.isActive('orderedList'),
      isQuote: editor.isActive('blockquote'),
      isCode: editor.isActive('code'),
      isCodeBlock: editor.isActive('codeBlock'),
      isLink: editor.isActive('link'),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  })

  if (!editor || !state) return null

  const run = (fn: () => void) => {
    fn()
    setLinkOpen(false)
  }

  const submitLink = () => {
    let href = linkUrl.trim()
    if (!href) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      setLinkOpen(false)
      return
    }
    if (!/^[a-z][a-z0-9+.-]*:/i.test(href)) href = `https://${href}`
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    setLinkUrl('')
    setLinkOpen(false)
  }

  return (
    <div className="note-rich-wrap">
      <div className="rich-toolbar">
        <ToolBtn
          title="Bold (Ctrl+B)"
          active={state.isBold}
          onClick={() => run(() => editor.chain().focus().toggleBold().run())}
        >
          <Bold size={15} />
        </ToolBtn>
        <ToolBtn
          title="Italic (Ctrl+I)"
          active={state.isItalic}
          onClick={() => run(() => editor.chain().focus().toggleItalic().run())}
        >
          <Italic size={15} />
        </ToolBtn>
        <ToolBtn
          title="Underline (Ctrl+U)"
          active={state.isUnderline}
          onClick={() =>
            run(() => editor.chain().focus().toggleUnderline().run())
          }
        >
          <UnderlineIcon size={15} />
        </ToolBtn>
        <ToolBtn
          title="Strikethrough"
          active={state.isStrike}
          onClick={() => run(() => editor.chain().focus().toggleStrike().run())}
        >
          <Strikethrough size={15} />
        </ToolBtn>
        <span className="rich-sep" />
        <ToolBtn
          title="Heading 1"
          active={state.h1}
          onClick={() =>
            run(() => editor.chain().focus().toggleHeading({ level: 1 }).run())
          }
        >
          <Heading1 size={15} />
        </ToolBtn>
        <ToolBtn
          title="Heading 2"
          active={state.h2}
          onClick={() =>
            run(() => editor.chain().focus().toggleHeading({ level: 2 }).run())
          }
        >
          <Heading2 size={15} />
        </ToolBtn>
        <ToolBtn
          title="Heading 3"
          active={state.h3}
          onClick={() =>
            run(() => editor.chain().focus().toggleHeading({ level: 3 }).run())
          }
        >
          <Heading3 size={15} />
        </ToolBtn>
        <span className="rich-sep" />
        <ToolBtn
          title="Bullet list"
          active={state.isBullet}
          onClick={() =>
            run(() => editor.chain().focus().toggleBulletList().run())
          }
        >
          <List size={15} />
        </ToolBtn>
        <ToolBtn
          title="Numbered list"
          active={state.isOrdered}
          onClick={() =>
            run(() => editor.chain().focus().toggleOrderedList().run())
          }
        >
          <ListOrdered size={15} />
        </ToolBtn>
        <ToolBtn
          title="Quote"
          active={state.isQuote}
          onClick={() =>
            run(() => editor.chain().focus().toggleBlockquote().run())
          }
        >
          <Quote size={15} />
        </ToolBtn>
        <span className="rich-sep" />
        <ToolBtn
          title="Inline code"
          active={state.isCode}
          onClick={() => run(() => editor.chain().focus().toggleCode().run())}
        >
          <Code2 size={15} />
        </ToolBtn>
        <ToolBtn
          title="Code block"
          active={state.isCodeBlock}
          onClick={() =>
            run(() => editor.chain().focus().toggleCodeBlock().run())
          }
        >
          <Code size={15} />
        </ToolBtn>
        <span className="rich-sep" />
        <ToolBtn
          title="Insert link"
          active={state.isLink}
          onClick={() => {
            if (linkOpen) {
              setLinkOpen(false)
              return
            }
            setLinkUrl(editor.getAttributes('link').href ?? '')
            setLinkOpen(true)
          }}
        >
          <Link2 size={15} />
        </ToolBtn>
        <ToolBtn
          title="Remove link"
          disabled={!state.isLink}
          onClick={() =>
            run(() =>
              editor.chain().focus().extendMarkRange('link').unsetLink().run(),
            )
          }
        >
          <Link2Off size={15} />
        </ToolBtn>
        <span className="rich-sep" />
        <ToolBtn
          title="Undo"
          disabled={!state.canUndo}
          onClick={() => run(() => editor.chain().focus().undo().run())}
        >
          <Undo2 size={15} />
        </ToolBtn>
        <ToolBtn
          title="Redo"
          disabled={!state.canRedo}
          onClick={() => run(() => editor.chain().focus().redo().run())}
        >
          <Redo2 size={15} />
        </ToolBtn>
      </div>

      {linkOpen && (
        <div className="rich-link-pop">
          <input
            autoFocus
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitLink()
              if (e.key === 'Escape') setLinkOpen(false)
            }}
            placeholder="https://…"
          />
          <button type="button" className="btn primary" onClick={submitLink}>
            Apply
          </button>
        </div>
      )}

      <EditorContent editor={editor} />

      <NoteLinkPopup
        open={suggest.open}
        options={options}
        index={suggestIndex}
        onPick={(opt) => insertSuggestion(editor, opt)}
        style={
          suggestPos
            ? {
                position: 'fixed',
                top: suggestPos.top,
                left: suggestPos.left,
              }
            : undefined
        }
      />
    </div>
  )
}

function handleImageTransfer(
  dt: DataTransfer | null,
  editorRef: EditorRef,
  insertImage: ((file: File) => Promise<string | null>) | undefined,
): boolean {
  if (!dt) return false
  const files = Array.from(dt.files).filter((f) => f.type.startsWith('image/'))
  if (!files.length) return false
  for (const file of files) {
    void (async () => {
      const id = insertImage ? await insertImage(file) : null
      if (id) {
        editorRef.current
          ?.chain()
          .focus()
          .setImage({ src: fileRefUrl(id), alt: file.name })
          .run()
      }
    })()
  }
  return true
}
