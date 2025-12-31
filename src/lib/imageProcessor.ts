/**
 * 图片处理工具：压缩、转换、存储
 * 遵循 AGENTS.md 规则：>500KB 压缩至 80%，<100KB 内嵌 base64
 */

const MAX_SIZE_BEFORE_COMPRESS = 500 * 1024 // 500KB
const COMPRESS_QUALITY = 0.8

/**
 * 压缩图片
 */
export async function compressImage(file: File, quality = COMPRESS_QUALITY): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      ctx.drawImage(img, 0, 0)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to compress image'))
          }
        },
        'image/jpeg',
        quality
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
 * 处理图片用于存储
 * - 超过 500KB 自动压缩至 80% 质量
 * - 返回 base64 格式
 */
export async function processImageForStorage(file: File): Promise<string> {
  let blob: Blob = file

  // 超过阈值则压缩
  if (file.size > MAX_SIZE_BEFORE_COMPRESS) {
    blob = await compressImage(file)
  }

  return blobToBase64(blob)
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
