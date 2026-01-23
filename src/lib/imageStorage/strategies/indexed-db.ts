/**
 * IndexedDB 存储策略
 * 用于 Web 浏览器环境，存储大图片到 IndexedDB
 */

import type { IImageStorageStrategy, ImageMetadata } from '../types'

const DB_NAME = 'goose-note-images'
const DB_VERSION = 1
const STORE_NAME = 'images'

export class IndexedDBStrategy implements IImageStorageStrategy {
  private db: IDBDatabase | null = null
  private initPromise: Promise<void> | null = null

  constructor() {
    this.initPromise = this.initDB()
  }

  /**
   * 初始化 IndexedDB
   */
  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          store.createIndex('createdAt', 'createdAt', { unique: false })
        }
      }
    })
  }

  /**
   * 保存图片到 IndexedDB
   */
  async save(blob: Blob, mimeType: string): Promise<string> {
    await this.initPromise

    const id = crypto.randomUUID()
    const metadata: ImageMetadata = {
      id,
      blob,
      mimeType,
      size: blob.size,
      createdAt: Date.now()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(metadata)

      request.onsuccess = () => resolve(`uuid:${id}`)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 从 IndexedDB 加载图片
   */
  async load(ref: string): Promise<Blob | null> {
    await this.initPromise

    const id = ref.replace('uuid:', '')
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(id)

      request.onsuccess = () => {
        const result = request.result as ImageMetadata | undefined
        resolve(result?.blob || null)
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 从 IndexedDB 删除图片
   */
  async delete(ref: string): Promise<void> {
    await this.initPromise

    const id = ref.replace('uuid:', '')
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * 检查是否处理该引用
   */
  canHandle(ref: string): boolean {
    return ref.startsWith('uuid:')
  }
}
