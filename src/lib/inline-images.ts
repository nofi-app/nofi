import type { FileItem } from './types'
import { downloadAttachment } from './files'

export function fileRefUrl(id: string): string {
  return `nofi://file/${id}`
}

export function parseFileRef(src: string): string | null {
  const m = /^nofi:\/\/file\/([0-9a-f-]+)$/i.exec(src.trim())
  return m ? m[1] : null
}

const blobCache = new Map<string, string>()

export async function resolveImage(
  img: HTMLImageElement,
  fileId: string,
  masterKey: CryptoKey,
  getFile: (id: string) => FileItem | undefined,
): Promise<void> {
  const cached = blobCache.get(fileId)
  if (cached) {
    img.src = cached
    return
  }
  const file = getFile(fileId)
  if (!file) return
  try {
    const blob = await downloadAttachment(masterKey, file)
    const url = URL.createObjectURL(blob)
    blobCache.set(fileId, url)
    img.src = url
    img.dataset.nofiLoaded = '1'
  } catch (err) {
    console.warn('Inline image resolve failed:', err)
  }
}

export function resolveImagesIn(
  container: HTMLElement | null | undefined,
  masterKey: CryptoKey,
  getFile: (id: string) => FileItem | undefined,
): void {
  if (!container || !masterKey) return
  const imgs = container.querySelectorAll<HTMLImageElement>(
    'img[src^="nofi://"]',
  )
  for (const img of Array.from(imgs)) {
    const src = img.getAttribute('src')
    if (!src) continue
    const id = parseFileRef(src)
    if (id) void resolveImage(img, id, masterKey, getFile)
  }
}
