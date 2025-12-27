
import type { StateStorage } from 'zustand/middleware'
import { UToolsAdapter } from './utools'

/**
 * Zustand storage adapter that uses UToolsAdapter.
 * It treats the whole store state (stringified JSON) as a single document's data.
 * Or strictly speaking, it maps keys to document IDs.
 */
export const uToolsStorage: StateStorage = {
  getItem: (name: string): string | null => {
    // Try to get from UToolsAdapter
    const result = UToolsAdapter.db.get<string>(name)
    if (result && result.data) {
        return result.data
    }
    return null
  },
  
  setItem: (name: string, value: string): void => {
    // We need to handle revisions if updating via uTools DB
    // But UToolsAdapter.db.put wrapper currently handles basic put.
    // However, native uTools db.put needs _rev if the doc exists.
    // My UToolsAdapter.db.put implementation (previous step) does NOT auto-fetch _rev
    // unless likely used in specific way.
    // Let's check UToolsAdapter implementation again or improve it here?
    // Actually, let's just use UToolsAdapter.db.put and let the adapter handle logic if complex,
    // or better: The Adapter's put method I wrote takes (id, data, rev).
    // The Web fallback mocks rev.
    // The uTools implementation simply passes it.
    // So we need to fetch the doc first to get _rev for update in uTools.
    
    const existing = UToolsAdapter.db.get(name)
    const rev = existing?._rev
    
    UToolsAdapter.db.put(name, value, rev)
  },
  
  removeItem: (name: string): void => {
    UToolsAdapter.db.remove(name)
  }
}
