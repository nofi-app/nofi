import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Item, NoteItem } from './types'
import { encryptItem } from './items'
import {
  fetchDeletedIds,
  planQueueFlush,
  pullUpdates,
  pushItem,
  subscribeToChanges,
  type RealtimeEvent,
} from './sync'
import type { QueuedMutation } from './offline-queue'

// ---------------------------------------------------------------------------
// Mocked Supabase client: a single chainable, thenable query builder whose
// resolved result can be swapped per test, plus a realtime channel whose
// postgres_changes callback is captured for manual invocation.
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  type Result = { data: unknown; error: unknown }
  let result: Result = { data: [], error: null }

  const query: any = {
    select: vi.fn(() => query),
    order: vi.fn(() => query),
    gt: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(() => query),
    upsert: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (r: Result) => void) => resolve(result),
  }

  let realtimeCallback:
    | ((payload: Record<string, unknown>) => Promise<void>)
    | null = null

  const channel = {
    on: vi.fn(
      (
        _event: string,
        _opts: unknown,
        cb: (payload: Record<string, unknown>) => Promise<void>,
      ) => {
        realtimeCallback = cb
        return channel
      },
    ),
    subscribe: vi.fn(() => channel),
  }

  const supabase = {
    from: vi.fn(() => query),
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(() => Promise.resolve()),
  }

  return {
    supabase,
    query,
    channel,
    setResult: (r: Result) => {
      result = r
    },
    realtimeCallback: () => realtimeCallback,
  }
})

vi.mock('./supabase', () => ({ supabase: mocks.supabase }))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function note(overrides: Partial<NoteItem> = {}): NoteItem {
  return {
    id: 'note-1',
    type: 'note',
    title: 'Hello',
    text: 'World',
    editor: 'plain',
    tags: [],
    folderId: null,
    pinned: false,
    archived: false,
    trashed: false,
    locked: false,
    deleted: false,
    createdAt: 1000,
    updatedAt: 2000,
    ...overrides,
  }
}

async function rowFor(masterKey: CryptoKey, item: Item) {
  const payload = await encryptItem(masterKey, item)
  return {
    id: item.id,
    user_id: 'user-1',
    content_type: item.type,
    encrypted_content: JSON.stringify(payload),
    deleted: item.deleted,
    created_at: new Date(item.createdAt).toISOString(),
    updated_at: new Date(item.updatedAt).toISOString(),
  }
}

async function makeMasterKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )
}

let masterKey: CryptoKey

beforeEach(async () => {
  vi.clearAllMocks()
  mocks.setResult({ data: [], error: null })
  masterKey = await makeMasterKey()
})

// ---------------------------------------------------------------------------
// pullUpdates
// ---------------------------------------------------------------------------

describe('pullUpdates', () => {
  it('decrypts non-deleted rows and skips tombstones', async () => {
    const alive = await rowFor(masterKey, note({ id: 'a', updatedAt: 3000 }))
    const tombstone = await rowFor(
      masterKey,
      note({ id: 'b', deleted: true, updatedAt: 4000 }),
    )
    mocks.setResult({
      data: [alive, tombstone],
      error: null,
    })

    const { items, lastSync } = await pullUpdates(masterKey, null)

    expect(items.map((i) => i.id)).toEqual(['a'])
    expect((items[0] as NoteItem).text).toBe('World')
    // lastSync is the max updated_at across ALL fetched rows, tombstone included.
    expect(lastSync).toBe(new Date(4000).toISOString())
    expect(mocks.query.order).toHaveBeenCalledWith('updated_at', {
      ascending: true,
    })
    // No `since` was passed, so the incremental cursor must not be applied.
    expect(mocks.query.gt).not.toHaveBeenCalled()
  })

  it('skips malformed rows that fail the stored-row check', async () => {
    mocks.setResult({
      data: [
        { id: 'junk', updated_at: '2024-01-01T00:00:00.000Z' }, // no content_type
        { not_a_row: true },
      ],
      error: null,
    })

    const { items } = await pullUpdates(masterKey, null)
    expect(items).toEqual([])
  })

  it('skips rows whose ciphertext cannot be decrypted', async () => {
    mocks.setResult({
      data: [
        {
          id: 'bad',
          content_type: 'note',
          encrypted_content: 'not-json',
          deleted: false,
          updated_at: '2024-01-01T00:00:00.000Z',
        },
      ],
      error: null,
    })

    const { items } = await pullUpdates(masterKey, null)
    expect(items).toEqual([])
  })

  it('passes `since` to the query for incremental pulls', async () => {
    await pullUpdates(masterKey, '2024-01-01T00:00:00.000Z')
    expect(mocks.query.gt).toHaveBeenCalledWith(
      'updated_at',
      '2024-01-01T00:00:00.000Z',
    )
  })

  it('throws when the query fails', async () => {
    mocks.setResult({ data: null, error: new Error('connection lost') })
    await expect(pullUpdates(masterKey, null)).rejects.toThrow(
      'Sync pull failed: connection lost',
    )
  })
})

// ---------------------------------------------------------------------------
// pushItem
// ---------------------------------------------------------------------------

describe('pushItem', () => {
  it('upserts a row carrying the item plaintext metadata and ciphertext', async () => {
    await pushItem('user-1', masterKey, note())

    const row = mocks.query.upsert.mock.calls[0][0]
    expect(mocks.supabase.from).toHaveBeenCalledWith('items')
    expect(row.id).toBe('note-1')
    expect(row.user_id).toBe('user-1')
    expect(row.content_type).toBe('note')
    expect(row.deleted).toBe(false)
    expect(JSON.parse(row.encrypted_content)).toHaveProperty('wrappedKey')
    expect(JSON.parse(row.encrypted_content)).toHaveProperty('payload')
  })

  it('passes the deleted flag through for tombstones', async () => {
    await pushItem('user-1', masterKey, note({ deleted: true }))
    const row = mocks.query.upsert.mock.calls[0][0]
    expect(row.deleted).toBe(true)
  })

  it('throws when the upsert fails', async () => {
    mocks.setResult({ data: null, error: new Error('quota exceeded') })
    await expect(pushItem('user-1', masterKey, note())).rejects.toThrow(
      'Sync push failed: quota exceeded',
    )
  })
})

// ---------------------------------------------------------------------------
// fetchDeletedIds
// ---------------------------------------------------------------------------

describe('fetchDeletedIds', () => {
  it('returns the ids of tombstoned rows', async () => {
    mocks.setResult({
      data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      error: null,
    })

    await expect(fetchDeletedIds()).resolves.toEqual(['a', 'b', 'c'])
    expect(mocks.query.eq).toHaveBeenCalledWith('deleted', true)
  })

  it('returns an empty array when there are no tombstones', async () => {
    mocks.setResult({ data: [], error: null })
    await expect(fetchDeletedIds()).resolves.toEqual([])
  })

  it('throws when the query fails', async () => {
    mocks.setResult({ data: null, error: new Error('nope') })
    await expect(fetchDeletedIds()).rejects.toThrow('Sync pull failed: nope')
  })
})

// ---------------------------------------------------------------------------
// subscribeToChanges
// ---------------------------------------------------------------------------

describe('subscribeToChanges', () => {
  it('emits a remove event for a hard-delete (legacy) event', async () => {
    const events: RealtimeEvent[] = []
    subscribeToChanges(masterKey, (e) => {
      events.push(e)
    })

    const cb = mocks.realtimeCallback()!
    await cb({ eventType: 'DELETE', old: { id: 'note-1' }, new: null })

    expect(events).toEqual([{ kind: 'remove', id: 'note-1' }])
    // A hard delete must not trigger a refetch.
    expect(mocks.supabase.from).not.toHaveBeenCalled()
  })

  it('emits a remove event when the refetched payload is a tombstone', async () => {
    const tombstone = await rowFor(
      masterKey,
      note({ id: 'note-1', deleted: true }),
    )
    mocks.setResult({ data: tombstone, error: null })

    const events: RealtimeEvent[] = []
    subscribeToChanges(masterKey, (e) => {
      events.push(e)
    })

    const cb = mocks.realtimeCallback()!
    await cb({ eventType: 'UPDATE', new: { id: 'note-1' } })

    expect(events).toEqual([{ kind: 'remove', id: 'note-1' }])
    expect(mocks.query.eq).toHaveBeenCalledWith('id', 'note-1')
  })

  it('emits an upsert event for a live payload', async () => {
    const row = await rowFor(masterKey, note({ id: 'note-1' }))
    mocks.setResult({ data: row, error: null })

    const events: RealtimeEvent[] = []
    subscribeToChanges(masterKey, (e) => {
      events.push(e)
    })

    const cb = mocks.realtimeCallback()!
    await cb({ eventType: 'INSERT', new: { id: 'note-1' } })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ kind: 'upsert' })
    if (events[0].kind === 'upsert') {
      expect(events[0].item.id).toBe('note-1')
      expect((events[0].item as NoteItem).text).toBe('World')
    }
    expect(mocks.query.eq).toHaveBeenCalledWith('id', 'note-1')
  })

  it('ignores payloads with no resolvable id', async () => {
    const events: RealtimeEvent[] = []
    subscribeToChanges(masterKey, (e) => {
      events.push(e)
    })

    const cb = mocks.realtimeCallback()!
    await cb({ eventType: 'UPDATE', new: null, old: null })

    expect(events).toEqual([])
  })

  it('cleanup removes the realtime channel', () => {
    const unsubscribe = subscribeToChanges(masterKey, () => {})
    unsubscribe()
    expect(mocks.supabase.removeChannel).toHaveBeenCalledWith(mocks.channel)
  })
})

// ---------------------------------------------------------------------------
// planQueueFlush
// ---------------------------------------------------------------------------

describe('planQueueFlush', () => {
  function mutation(
    id: number,
    type: QueuedMutation['type'],
    item: unknown,
  ): QueuedMutation {
    return { id, type, item, timestamp: 1, retries: 0 }
  }

  it('drops add/update/trash for tombstoned ids but keeps the remove', () => {
    const queued = [
      mutation(1, 'update', note({ id: 'deleted-note' })),
      mutation(2, 'trash', note({ id: 'deleted-note' })),
      mutation(3, 'remove', note({ id: 'deleted-note' })),
      mutation(4, 'add', note({ id: 'fresh-note' })),
    ]

    const { push, drop } = planQueueFlush(
      queued,
      new Set(['deleted-note']),
    )

    expect(drop.map((m) => m.id)).toEqual([1, 2])
    // The remove becomes a tombstone push: it must survive the filter.
    expect(push.map((m) => m.id)).toEqual([3, 4])
  })

  it('keeps everything when there are no tombstones', () => {
    const queued = [mutation(1, 'add', note())]
    const { push, drop } = planQueueFlush(queued, new Set())
    expect(push).toEqual(queued)
    expect(drop).toEqual([])
  })

  it('returns empty arrays for an empty queue', () => {
    const { push, drop } = planQueueFlush([], new Set(['x']))
    expect(push).toEqual([])
    expect(drop).toEqual([])
  })
})
