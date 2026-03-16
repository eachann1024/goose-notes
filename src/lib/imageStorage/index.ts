/**
 * 图片存储统一入口
 * 根据笔记来源自动选择最优存储策略
 */

import type { IImageStorageStrategy } from './types'
import { AttachmentStrategy } from './strategies/attachment'
import { FileSystemStrategy } from './strategies/file-system'
import { InlinedStrategy } from './strategies/inlined'

/**
 * 图片存储管理器
 */
export class ImageStorage {
  private strategy: IImageStorageStrategy | null = null
  private strategyPromise: Promise<IImageStorageStrategy> | null = null
  private inlinedStrategy: InlinedStrategy
  private localFolderAccessResolver: (() => boolean | Promise<boolean>) | null =
    null

  constructor() {
    // 小图片策略（< 100KB）
    this.inlinedStrategy = new InlinedStrategy(100 * 1024)
  }

  /**
   * 根据笔记来源选择存储策略
   */
  private async resolveStrategy(): Promise<IImageStorageStrategy> {
    if (this.strategy) return this.strategy
    if (this.strategyPromise) return this.strategyPromise

    this.strategyPromise = (async () => {
      const hasLocalFolder = await this.checkLocalFolderAccess()

      if (hasLocalFolder) {
        return new FileSystemStrategy()
      }

      return new AttachmentStrategy()
    })()

    this.strategy = await this.strategyPromise
    this.strategyPromise = null
    return this.strategy
  }

  /**
   * 检测是否有本地文件夹访问权限
   */
  private async checkLocalFolderAccess(): Promise<boolean> {
    if (!this.localFolderAccessResolver) return false
    const resolved = this.localFolderAccessResolver()
    return await Promise.resolve(resolved)
  }

  /**
   * 注入本地文件夹访问检测器（避免依赖 store 造成循环）
   */
  setLocalFolderAccessResolver(
    resolver: () => boolean | Promise<boolean>,
  ): void {
    this.localFolderAccessResolver = resolver
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

    // 尝试 attachment 策略（兼容默认模式切换场景）
    const attStrategy = new AttachmentStrategy()
    if (attStrategy.canHandle(ref)) {
      return attStrategy.load(ref)
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

    // 尝试 attachment 策略
    const attStrategy = new AttachmentStrategy()
    if (attStrategy.canHandle(ref)) {
      return attStrategy.delete(ref)
    }
  }
}

// 单例导出
export const imageStorage = new ImageStorage()

// 重新导出类型
export * from './types'
export * from './utils'
