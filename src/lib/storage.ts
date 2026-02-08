import type { StateStorage } from 'zustand/middleware'
import { UToolsAdapter } from './utools'

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 100
const queuedStorageValues = new Map<string, string>()
const storageWriteChains = new Map<string, Promise<void>>()

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const isWebStorageAvailable = () => {
  if (typeof window === 'undefined') return false
  try {
    return typeof window.localStorage !== 'undefined'
  } catch {
    return false
  }
}

interface SyncStorageFallback {
  getItem: (name: string) => string | null
  setItem: (name: string, value: string) => void
  removeItem: (name: string) => void
}

const localStorageFallback: SyncStorageFallback = {
  getItem: (name: string): string | null => {
    if (!isWebStorageAvailable()) return null
    try {
      return window.localStorage.getItem(name)
    } catch (err) {
      console.error('[localStorageFallback] getItem failed', name, err)
      return null
    }
  },
  setItem: (name: string, value: string): void => {
    if (!isWebStorageAvailable()) return
    try {
      window.localStorage.setItem(name, value)
    } catch (err) {
      console.error('[localStorageFallback] setItem failed', name, err)
    }
  },
  removeItem: (name: string): void => {
    if (!isWebStorageAvailable()) return
    try {
      window.localStorage.removeItem(name)
    } catch (err) {
      console.error('[localStorageFallback] removeItem failed', name, err)
    }
  },
}

const notifyPersistFailure = (name: string) => {
  const hostWindow = window as Window & {
    utools?: {
      showNotification?: (message: string) => void
    }
  }

  if (hostWindow.utools?.showNotification) {
    hostWindow.utools.showNotification(
      `数据保存失败: ${name}，请检查存储空间`
    )
  }
}

const putWithRetry = async (name: string, value: string): Promise<void> => {
  const tryPut = (rev?: string, retryCount = 0): boolean => {
    try {
      const res = UToolsAdapter.db.put(name, value, rev)
      if (!res || res.ok === false) {
        throw new Error(JSON.stringify(res))
      }
      return true
    } catch (err) {
      console.error('[uToolsStorage] put failed', { name, rev, err, retryCount })
      if (retryCount >= MAX_RETRIES - 1) {
        notifyPersistFailure(name)
      }
      return false
    }
  }

  let rev: string | undefined
  try {
    rev = UToolsAdapter.db.get(name)?._rev
  } catch (err) {
    console.error('[uToolsStorage] get rev failed before put', name, err)
  }

  if (tryPut(rev, 0)) return

  for (let i = 1; i < MAX_RETRIES; i++) {
    try {
      const latest = UToolsAdapter.db.get(name)
      if (tryPut(latest?._rev, i)) return
    } catch (err) {
      console.error('[uToolsStorage] retry failed', { name, attempt: i, err })
    }
    await sleep(RETRY_DELAY_MS)
  }
}

const flushStorageKeyQueue = (name: string): Promise<void> => {
  const chain = storageWriteChains.get(name) ?? Promise.resolve()
  const next = chain
    .catch(() => {})
    .then(async () => {
      while (queuedStorageValues.has(name)) {
        const latestValue = queuedStorageValues.get(name)
        queuedStorageValues.delete(name)
        if (typeof latestValue !== 'string') continue
        await putWithRetry(name, latestValue)
      }
    })

  const finalized = next.finally(() => {
    if (storageWriteChains.get(name) === finalized) {
      storageWriteChains.delete(name)
    }
  })
  storageWriteChains.set(name, finalized)
  return finalized
}

export const flushUToolsStorageWrites = async (): Promise<void> => {
  const keys = new Set<string>([
    ...queuedStorageValues.keys(),
    ...storageWriteChains.keys(),
  ])
  await Promise.all(Array.from(keys).map((key) => flushStorageKeyQueue(key)))
}

export const uToolsStorage: StateStorage = {
  getItem: (name: string): string | null => {
    if (!UToolsAdapter.isUTools) {
      return localStorageFallback.getItem(name)
    }
    try {
      const result = UToolsAdapter.db.get<string>(name)
      return result?.data ?? null
    } catch (err) {
      console.error('[uToolsStorage] getItem failed', name, err)
      return null
    }
  },

  setItem: async (name: string, value: string): Promise<void> => {
    if (!UToolsAdapter.isUTools) {
      localStorageFallback.setItem(name, value)
      return
    }
    queuedStorageValues.set(name, value)
    await flushStorageKeyQueue(name)
  },
  
  removeItem: (name: string): void => {
    if (!UToolsAdapter.isUTools) {
      localStorageFallback.removeItem(name)
      return
    }
    try {
      queuedStorageValues.delete(name)
      UToolsAdapter.db.remove(name)
    } catch (err) {
      console.error('[uToolsStorage] removeItem failed', name, err)
    }
  }
}
