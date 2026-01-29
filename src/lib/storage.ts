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
    const MAX_RETRIES = 3

    const tryPut = (rev?: string, retryCount = 0): boolean => {
      try {
        const res = UToolsAdapter.db.put(name, value, rev)
        if (!res || res.ok === false) {
          throw new Error(JSON.stringify(res))
        }
        return true
      } catch (err) {
        console.error('[uToolsStorage] put failed', { name, rev, err, retryCount })

        // 失败时通知用户
        if (retryCount >= MAX_RETRIES - 1) {
          if ((window as any).utools) {
            (window as any).utools.showNotification(
              `数据保存失败: ${name}，请检查存储空间`
            )
          }
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

    // 重试逻辑（最多3次）
    for (let i = 1; i < MAX_RETRIES; i++) {
      try {
        const latest = UToolsAdapter.db.get(name)
        if (tryPut(latest?._rev, i)) return
      } catch (err) {
        console.error('[uToolsStorage] retry failed', { name, attempt: i, err })
      }

      // 每次重试间隔 100ms
      const start = Date.now()
      while (Date.now() - start < 100) {
        // busy wait
      }
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
