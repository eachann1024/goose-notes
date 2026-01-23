/**
 * Base64 存储策略
 * 用于 uTools 默认模式，保持现有 Base64 方案（支持多端同步）
 */

import type { IImageStorageStrategy } from '../types'
import { blobToBase64 } from '../utils'
import { compressImage } from '../../imageProcessor'

const COMPRESS_THRESHOLD = 500 * 1024 // 500KB
const COMPRESS_QUALITY = 0.8

export class Base64Strategy implements IImageStorageStrategy {
  /**
   * 保存为 base64（压缩大图片）
   */
  async save(blob: Blob, mimeType: string): Promise<string> {
    // 压缩 > 500KB 的图片
    let processedBlob = blob
    if (blob.size > COMPRESS_THRESHOLD) {
      const file = new File([blob], 'image.jpg', { type: mimeType })
      processedBlob = await compressImage(file, COMPRESS_QUALITY)
    }

    return blobToBase64(processedBlob)
  }

  /**
   * 加载 - base64 数据直接使用
   */
  async load(_ref: string): Promise<Blob | null> {
    // 返回 null 表示直接使用 ref 作为 src
    return null
  }

  /**
   * 删除 - base64 存在文档中，删除时自动清理
   */
  async delete(_ref: string): Promise<void> {
    // Base64 存在文档中，删除文档时自动清理
  }

  /**
   * 检查是否处理该引用
   */
  canHandle(ref: string): boolean {
    return ref.startsWith('data:image/')
  }
}
