import type { StateStorage } from 'zustand/middleware'
import { UToolsAdapter } from './utools'

export const uToolsStorage: StateStorage = {
  getItem: (name: string): string | null => {
    try {
      const result = UToolsAdapter.db.get<string>(name)
      return result?.data ?? null
    } catch (err) {
      console.error('[uToolsStorage] getItem failed', name, err)
      return null
    }
  },

  setItem: (name: string, value: string): void => {
    const tryPut = (rev?: string) => {
      try {
        const res = UToolsAdapter.db.put(name, value, rev)
        if (!res || res.ok === false) {
          throw new Error(JSON.stringify(res))
        }
        return true
      } catch (err) {
        console.error('[uToolsStorage] put failed', { name, rev, err })
        return false
      }
    }

    let rev: string | undefined
    try {
      rev = UToolsAdapter.db.get(name)?._rev
    } catch (err) {
      console.error('[uToolsStorage] get rev failed before put', name, err)
    }

    if (tryPut(rev)) return

    try {
      const latest = UToolsAdapter.db.get(name)
      tryPut(latest?._rev)
    } catch (err) {
      console.error('[uToolsStorage] retry get rev failed', name, err)
    }
  },
  
  removeItem: (name: string): void => {
    try {
      UToolsAdapter.db.remove(name)
    } catch (err) {
      console.error('[uToolsStorage] removeItem failed', name, err)
    }
  }
}
