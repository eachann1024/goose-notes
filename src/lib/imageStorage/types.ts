/**
 * 图片存储类型定义
 */

/**
 * 图片存储策略接口
 * 所有存储策略都需要实现这个接口
 */
export interface IImageStorageStrategy {
  /**
   * 存储图片，返回引用标识符
   * @param blob 图片数据
   * @param mimeType MIME 类型
   * @returns 引用标识符（uuid:xxx 或 ./assets/xxx.jpg 或 data:...）
   */
  save(blob: Blob, mimeType: string): Promise<string>

  /**
   * 根据引用标识符获取图片
   * @param ref 引用标识符
   * @returns 图片 Blob，如果不存在返回 null
   */
  load(ref: string): Promise<Blob | null>

  /**
   * 删除图片
   * @param ref 引用标识符
   */
  delete(ref: string): Promise<void>

  /**
   * 检查引用是否由该策略处理
   * @param ref 引用标识符
   */
  canHandle(ref: string): boolean
}

/**
 * 存储配置
 */
export interface StorageConfig {
  inlineThreshold: number  // 内嵌阈值（字节），默认 100KB
  compressThreshold: number // 压缩阈值（字节），默认 500KB
  compressQuality: number   // 压缩质量，默认 0.8
  maxEdge: number           // 最大边长（像素），超过则等比降采样，默认 2560
}

/**
 * 默认存储配置
 */
export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
  inlineThreshold: 100 * 1024,   // 100KB
  compressThreshold: 500 * 1024, // 500KB
  compressQuality: 0.8,
  maxEdge: 2560,
}

/**
 * 存储策略类型
 */
export type StorageStrategyType = 'base64' | 'attachment' | 'file-system' | 'inlined'
