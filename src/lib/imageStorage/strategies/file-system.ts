/**
 * 文件系统存储策略
 * 用于 uTools 本地文件模式，保存图片到 ./assets/ 文件夹
 */

import type { IImageStorageStrategy } from '../types'
import { blobToBase64 } from '../utils'
import { fs } from '@/lib/utools/fs'

// 声明 gooseFs 类型
// declare global {
//   interface Window {
//     gooseFs?: {
//       exists(path: string): boolean
//       mkdir(path: string): boolean
//       writeFile(path: string, data: string, encoding: string): boolean
//       readFile(path: string, encoding: string): string
//       deleteFile(path: string): boolean
//     }
//   }
// }

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

    // 获取当前笔记本路径
    const notebookPath = await this.getCurrentNotebookPath()
    if (!notebookPath) {
      throw new Error('No notebook path found')
    }

    // 创建 assets 文件夹
    const assetsDir = `${notebookPath}/assets`
    if (!fs.exists(assetsDir)) {
      await fs.mkdir(assetsDir)
    }

    // 生成文件名
    const timestamp = Date.now()
    const random = crypto.randomUUID().slice(0, 8)
    const ext = this.getExtension(mimeType)
    const filename = `img_${timestamp}_${random}.${ext}`

    // 写入文件
    const base64 = await blobToBase64(blob)
    const base64Data = base64.split(',')[1]
    const fullPath = `${assetsDir}/${filename}`

    fs.writeFile(fullPath, base64Data, 'base64')

    return `./assets/${filename}`
  }

  /**
   * 加载 - 本地文件直接用路径加载
   */
  async load(_ref: string): Promise<Blob | null> {
    // 返回 null 表示直接使用 ref 作为路径
    return null
  }

  /**
   * 删除文件
   */
  async delete(ref: string): Promise<void> {
    if (!fs.isAvailable()) return

    const filename = ref.replace('./assets/', '')
    const notebookPath = await this.getCurrentNotebookPath()
    if (!notebookPath) return

    const fullPath = `${notebookPath}/assets/${filename}`
    await fs.deleteFile(fullPath)
  }

  /**
   * 检查是否处理该引用
   */
  canHandle(ref: string): boolean {
    return ref.startsWith('./assets/')
  }

  /**
   * 获取当前笔记本路径
   */
  private async getCurrentNotebookPath(): Promise<string | null> {
    return (await Promise.resolve(this.getNotebookPath?.())) || null
  }

  /**
   * 获取文件扩展名
   */
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
