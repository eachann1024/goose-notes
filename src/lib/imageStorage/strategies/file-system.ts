/**
 * 文件系统存储策略
 * 用于 uTools 本地文件模式，保存图片到 ./assets/ 文件夹
 * 加载时支持所有本地路径格式：
 *   - ./assets/x.png        相对路径（当前目录）
 *   - ../assets/x.png       相对路径（上级目录）
 *   - assets/x.png          无前缀相对路径
 *   - /abs/path/x.png       绝对路径（Unix）
 *   - C:\path\x.png         绝对路径（Windows）
 */

import type { IImageStorageStrategy } from '../types'
import { blobToBase64 } from '../utils'
import { fs } from '@/lib/utools/fs'

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|svg|bmp|ico|tiff?)$/i

/**
 * 判断 ref 是否为本地文件路径（非网络 / 非 data: / 非内部引用）
 */
export function isLocalFilePath(ref: string): boolean {
  if (!ref || ref.length === 0) return false
  if (
    ref.startsWith('http://') ||
    ref.startsWith('https://') ||
    ref.startsWith('data:') ||
    ref.startsWith('blob:') ||
    ref.startsWith('uuid:') ||
    ref.startsWith('att:')
  ) {
    return false
  }
  // 绝对路径
  if (ref.startsWith('/') || /^[A-Za-z]:[\\/]/.test(ref)) return true
  // 相对路径：./ ../ .\ ..\
  if (/^\.{1,2}[\\/]/.test(ref)) return true
  // 无前缀但含图片扩展名的纯路径（如 assets/x.png）
  if (!ref.includes('://') && IMAGE_EXTENSIONS.test(ref)) return true
  return false
}

/**
 * 将相对路径基于 basePath 解析为绝对路径
 */
export function resolveToAbsolute(basePath: string, ref: string): string {
  const sep = basePath.includes('\\') ? '\\' : '/'
  // 已经是绝对路径
  if (ref.startsWith('/') || /^[A-Za-z]:[\\/]/.test(ref)) return ref
  const base = basePath.replace(/[\\/]+$/, '')
  const normalized = ref.replace(/^\.[\\/]/, '')
  const parts = `${base}${sep}${normalized}`.split(/[\\/]/)
  const resolved: string[] = []
  for (const p of parts) {
    if (p === '..') resolved.pop()
    else if (p !== '.' && p !== '') resolved.push(p)
  }
  // Unix 绝对路径需要前缀 /
  const prefix = basePath.startsWith('/') ? '/' : ''
  return prefix + resolved.join(sep)
}

export class FileSystemStrategy implements IImageStorageStrategy {
  private readonly getNotebookPath?: () => string | null | Promise<string | null>

  constructor(
    getNotebookPath?: () => string | null | Promise<string | null>,
  ) {
    this.getNotebookPath = getNotebookPath
  }

  /**
   * 保存图片到文件系统
   */
  async save(blob: Blob, mimeType: string): Promise<string> {
    if (!fs.isAvailable()) {
      throw new Error('gooseFs not available')
    }

    const notebookPath = await this.getCurrentNotebookPath()
    if (!notebookPath) {
      throw new Error('No notebook path found')
    }

    const assetsDir = `${notebookPath}/assets`
    if (!fs.exists(assetsDir)) {
      await fs.mkdir(assetsDir)
    }

    const timestamp = Date.now()
    const random = crypto.randomUUID().slice(0, 8)
    const ext = this.getExtension(mimeType)
    const filename = `img_${timestamp}_${random}.${ext}`

    const base64 = await blobToBase64(blob)
    const base64Data = base64.split(',')[1]
    const fullPath = `${assetsDir}/${filename}`

    fs.writeFile(fullPath, base64Data, 'base64')

    return `./assets/${filename}`
  }

  /**
   * 加载本地文件为 Blob
   * 将相对/绝对路径解析后从文件系统读取
   */
  async load(ref: string): Promise<Blob | null> {
    if (!fs.isAvailable()) return null
    const gfs = (window as any).gooseFs
    if (!gfs) return null

    const notebookPath = await this.getCurrentNotebookPath()
    let fullPath: string

    if (ref.startsWith('/') || /^[A-Za-z]:[\\/]/.test(ref)) {
      fullPath = ref
    } else if (notebookPath) {
      fullPath = resolveToAbsolute(notebookPath, ref)
    } else {
      return null
    }

    try {
      if (!gfs.exists(fullPath)) return null
      const base64Data: string | null = gfs.readFile(fullPath, 'base64')
      if (!base64Data) return null
      // 猜 mime
      const ext = fullPath.split('.').pop()?.toLowerCase() || 'png'
      const mimeMap: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
        bmp: 'image/bmp', ico: 'image/x-icon', tif: 'image/tiff', tiff: 'image/tiff',
      }
      const mime = mimeMap[ext] || 'image/png'
      const binary = atob(base64Data)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      return new Blob([bytes], { type: mime })
    } catch {
      return null
    }
  }

  /**
   * 删除文件
   */
  async delete(ref: string): Promise<void> {
    if (!fs.isAvailable()) return

    const notebookPath = await this.getCurrentNotebookPath()
    if (!notebookPath) return

    let fullPath: string
    if (ref.startsWith('/') || /^[A-Za-z]:[\\/]/.test(ref)) {
      fullPath = ref
    } else {
      fullPath = resolveToAbsolute(notebookPath, ref)
    }

    await fs.deleteFile(fullPath)
  }

  /**
   * 检查是否处理该引用
   * 支持所有本地文件路径格式
   */
  canHandle(ref: string): boolean {
    return isLocalFilePath(ref)
  }

  private async getCurrentNotebookPath(): Promise<string | null> {
    return (await Promise.resolve(this.getNotebookPath?.())) || null
  }

  private getExtension(mimeType: string): string {
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'image/bmp': 'bmp'
    }
    return extMap[mimeType] || 'jpg'
  }
}
