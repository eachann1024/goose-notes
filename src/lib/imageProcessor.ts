/**
 * 图片处理工具：压缩、转换、存储
 * 遵循 AGENTS.md 规则：>500KB 压缩至 80%，<100KB 内嵌 base64
 */

import type { StorageConfig } from './imageStorage/types'
import { DEFAULT_STORAGE_CONFIG } from './imageStorage/types'

/**
 * 统一压缩入口：降采样 + 格式转换 + 压缩
 *
 * 规则：
 * - SVG (image/svg+xml) 直接跳过，原样返回
 * - max(width, height) > cfg.maxEdge 时等比降采样到 maxEdge
 * - PNG 保留为 image/png（透明通道），其余输出 image/webp
 * - 仅当 size > cfg.compressThreshold 或发生了降采样/格式转换时才重新编码
 */
export async function compressIfNeeded(
  input: Blob | File,
  cfg: StorageConfig = DEFAULT_STORAGE_CONFIG,
): Promise<Blob> {
  // SVG 矢量图直接跳过，不做任何转换
  if (input.type === 'image/svg+xml') {
    return input
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(input)

    img.onload = () => {
      URL.revokeObjectURL(url)

      const { width: origW, height: origH } = img
      const maxEdge = cfg.maxEdge ?? DEFAULT_STORAGE_CONFIG.maxEdge

      // 计算目标尺寸（等比降采样）
      let targetW = origW
      let targetH = origH
      const needsResize = Math.max(origW, origH) > maxEdge
      if (needsResize) {
        if (origW >= origH) {
          targetW = maxEdge
          targetH = Math.round((origH / origW) * maxEdge)
        } else {
          targetH = maxEdge
          targetW = Math.round((origW / origH) * maxEdge)
        }
      }

      // 输出格式：PNG 保留，其余 webp
      const isPng = input.type === 'image/png'
      const outputMime = isPng ? 'image/png' : 'image/webp'
      const formatChanged = input.type !== outputMime

      // 如果不需要降采样、不需要格式转换、且体积未超阈值，原样返回
      if (!needsResize && !formatChanged && input.size <= cfg.compressThreshold) {
        resolve(input)
        return
      }

      const canvas = document.createElement('canvas')
      canvas.width = targetW
      canvas.height = targetH

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      ctx.drawImage(img, 0, 0, targetW, targetH)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to encode image'))
          }
        },
        outputMime,
        cfg.compressQuality,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}

/**
 * 压缩图片（向后兼容薄封装，委托给 compressIfNeeded）
 */
export async function compressImage(file: File, quality = DEFAULT_STORAGE_CONFIG.compressQuality): Promise<Blob> {
  return compressIfNeeded(file, { ...DEFAULT_STORAGE_CONFIG, compressQuality: quality })
}

/**
 * 文件/Blob 转 base64
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      resolve(reader.result as string)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * 从剪切板事件提取图片文件
 */
export function getImageFromClipboard(event: ClipboardEvent): File | null {
  const items = event.clipboardData?.items
  if (!items) return null

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      return item.getAsFile()
    }
  }

  return null
}

/**
 * 校验是否为有效的图片 URL
 */
export function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ['http:', 'https:', 'data:'].includes(parsed.protocol)
  } catch {
    return false
  }
}
