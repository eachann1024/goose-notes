/**
 * 文件系统存储策略
 * 用于 uTools 本地文件模式，保存图片到 ./assets/ 文件夹
 */

import type { IImageStorageStrategy } from '../types'
import { blobToBase64 } from '../utils'
import { useNotebooks } from '@/stores/useNotebooks'
import { usePages } from '@/stores/usePages'

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
  /**
   * 保存图片到文件系统
   */
  async save(blob: Blob, mimeType: string): Promise<string> {
    const gooseFs = window.gooseFs
    if (!gooseFs) {
      throw new Error('gooseFs not available')
    }

    // 获取当前笔记本路径
    const notebookPath = this.getCurrentNotebookPath()
    if (!notebookPath) {
      throw new Error('No notebook path found')
    }

    // 创建 assets 文件夹
    const assetsDir = `${notebookPath}/assets`
    if (!gooseFs.exists(assetsDir)) {
      gooseFs.mkdir(assetsDir)
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

    gooseFs.writeFile(fullPath, base64Data, 'base64')

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
    const gooseFs = window.gooseFs
    if (!gooseFs) return

    const filename = ref.replace('./assets/', '')
    const notebookPath = this.getCurrentNotebookPath()
    if (!notebookPath) return

    const fullPath = `${notebookPath}/assets/${filename}`
    await gooseFs.deleteFile(fullPath)
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
  private getCurrentNotebookPath(): string | null {
    const activePageId = usePages.getState().activePageId
    if (!activePageId) return null

    const page = usePages.getState().pages[activePageId]
    if (!page) return null

    const notebook = useNotebooks.getState().notebooks[page.workspaceId]
    return notebook?.localPath || null
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
