/**
 * Attachment 存储策略
 * 用于 uTools 默认模式，使用 db.postAttachment 存储二进制图片
 * 相比 Base64Strategy：支持 10MB 上限（vs 1MB），且不膨胀文档体积
 */

import type { IImageStorageStrategy } from '../types'
import { UToolsAdapter } from '../../utools'
import { compressImage } from '../../imageProcessor'

const COMPRESS_THRESHOLD = 500 * 1024 // 500KB
const COMPRESS_QUALITY = 0.8
const ATT_PREFIX = 'att:'
const ID_PREFIX = 'goose-img/'

export class AttachmentStrategy implements IImageStorageStrategy {
  /**
   * 保存图片为 uTools attachment
   */
  async save(blob: Blob, mimeType: string): Promise<string> {
    // 压缩 > 500KB 的图片
    let processedBlob = blob
    if (blob.size > COMPRESS_THRESHOLD) {
      const file = new File([blob], 'image.jpg', { type: mimeType })
      processedBlob = await compressImage(file, COMPRESS_QUALITY)
      mimeType = 'image/jpeg'
    }

    // Blob → Uint8Array
    const buffer = new Uint8Array(await processedBlob.arrayBuffer())

    // 生成唯一 ID
    const id = `${ID_PREFIX}${Date.now()}_${crypto.randomUUID().slice(0, 8)}`

    // 存储到 uTools attachment
    const result = UToolsAdapter.db.postAttachment(id, buffer, mimeType)
    if (!result || result.ok === false) {
      throw new Error(`Failed to save attachment: ${JSON.stringify(result?.error)}`)
    }

    return `${ATT_PREFIX}${id}`
  }

  /**
   * 加载附件图片
   */
  async load(ref: string): Promise<Blob | null> {
    const id = ref.slice(ATT_PREFIX.length)
    const data = UToolsAdapter.db.getAttachment(id)
    if (!data) return null

    const mimeType = UToolsAdapter.db.getAttachmentType(id) || 'image/jpeg'
    return new Blob([data.buffer as ArrayBuffer], { type: mimeType })
  }

  /**
   * 删除附件
   */
  async delete(ref: string): Promise<void> {
    const id = ref.slice(ATT_PREFIX.length)
    try {
      UToolsAdapter.db.remove(id)
    } catch {
      // 忽略删除失败
    }
  }

  /**
   * 检查是否处理该引用
   */
  canHandle(ref: string): boolean {
    return ref.startsWith(ATT_PREFIX)
  }
}
