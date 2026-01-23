/**
 * 图片存储统一入口
 * 根据运行环境自动选择最优存储策略
 */

import type { IImageStorageStrategy } from './types'
import { IndexedDBStrategy } from './strategies/indexed-db'
import { Base64Strategy } from './strategies/base64'
import { FileSystemStrategy } from './strategies/file-system'
import { InlinedStrategy } from './strategies/inlined'
import { UToolsAdapter } from '../utools'

/**
 * 图片存储管理器
 */
export class ImageStorage {
  private strategy: IImageStorageStrategy | null = null
  private strategyPromise: Promise<IImageStorageStrategy> | null = null
  private inlinedStrategy: InlinedStrategy

  constructor() {
    // 小图片策略（< 100KB）
    this.inlinedStrategy = new InlinedStrategy(100 * 1024)
  }

  /**
   * 根据环境选择存储策略
   */
  private async resolveStrategy(): Promise<IImageStorageStrategy> {
    if (this.strategy) return this.strategy
    if (this.strategyPromise) return this.strategyPromise

    this.strategyPromise = (async () => {
      if (UToolsAdapter.isUTools) {
        // uTools 环境：检测是否有本地文件访问权限
        const hasLocalFolder = await this.checkLocalFolderAccess()

        if (hasLocalFolder) {
          return new FileSystemStrategy()
        }
        return new Base64Strategy()
      }

      // Web 浏览器环境
      return new IndexedDBStrategy()
    })()

    this.strategy = await this.strategyPromise
    this.strategyPromise = null
    return this.strategy
  }

  /**
   * 检测是否有本地文件夹访问权限
   */
  private async checkLocalFolderAccess(): Promise<boolean> {
    const { usePages } = await import('@/stores/usePages')
    const { useNotebooks } = await import('@/stores/useNotebooks')
    const activePageId = usePages.getState().activePageId
    if (!activePageId) return false

    const page = usePages.getState().pages[activePageId]
    if (!page) return false

    const notebook = useNotebooks.getState().notebooks[page.workspaceId]
    return notebook?.source === 'local-folder' && !!notebook.localPath
  }

  /**
   * 存储图片
   * - 小图片（< 100KB）：直接 base64 内嵌
   * - 大图片（≥ 100KB）：使用策略存储
   */
  async save(blob: Blob, mimeType: string): Promise<string> {
    // 小图片直接内嵌
    if (blob.size < 100 * 1024) {
      return this.inlinedStrategy.save(blob, mimeType)
    }

    // 大图片使用策略存储
    const strategy = await this.resolveStrategy()
    return strategy.save(blob, mimeType)
  }

  /**
   * 加载图片
   */
  async load(ref: string): Promise<Blob | null> {
    // 先检查内联策略
    if (this.inlinedStrategy.canHandle(ref)) {
      return this.inlinedStrategy.load(ref)
    }

    // 检查主策略
    const strategy = await this.resolveStrategy()
    if (strategy.canHandle(ref)) {
      return strategy.load(ref)
    }

    // 尝试文件系统策略（兼容本地文件模式）
    const fsStrategy = new FileSystemStrategy()
    if (fsStrategy.canHandle(ref)) {
      return fsStrategy.load(ref)
    }

    return null
  }

  /**
   * 删除图片
   */
  async delete(ref: string): Promise<void> {
    if (this.inlinedStrategy.canHandle(ref)) {
      return this.inlinedStrategy.delete(ref)
    }

    const strategy = await this.resolveStrategy()
    if (strategy.canHandle(ref)) {
      return strategy.delete(ref)
    }

    // 尝试文件系统策略
    const fsStrategy = new FileSystemStrategy()
    if (fsStrategy.canHandle(ref)) {
      return fsStrategy.delete(ref)
    }
  }
}

// 单例导出
export const imageStorage = new ImageStorage()

// 重新导出类型
export * from './types'
export * from './utils'
