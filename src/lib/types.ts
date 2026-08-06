export type ContentType = 'note' | 'tag' | 'folder' | 'file'

export interface BaseItem {
  id: string
  type: ContentType
  createdAt: number
  updatedAt: number
  deleted: boolean
}

export type NoteEditorType = 'plain' | 'markdown' | 'rich' | 'code' | 'checklist'

export interface NoteItem extends BaseItem {
  type: 'note'
  editor: NoteEditorType
  title: string
  text: string
  tags: string[]
  folderId: string | null
  pinned: boolean
  archived: boolean
  trashed: boolean
}

export interface TagItem extends BaseItem {
  type: 'tag'
  name: string
}

export interface FolderItem extends BaseItem {
  type: 'folder'
  name: string
  parentId: string | null
}

export interface FileItem extends BaseItem {
  type: 'file'
  name: string
  mimeType: string
  size: number
  noteId: string
  storagePath: string
  key: string
}

export type Item = NoteItem | TagItem | FolderItem | FileItem

export type Filter =
  | { kind: 'all' }
  | { kind: 'trash' }
  | { kind: 'tag'; id: string }
  | { kind: 'folder'; id: string }
