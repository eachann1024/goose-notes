export type { JSONContent } from '@tiptap/react'

export type SyncProvider = 'local' | 'jianguoyun' | 'icloud'
export type FontFamily = 'default' | 'serif' | 'mono'
export type FontSize = 'default' | 'small'

export interface User {
  id: string
  name: string
  avatar?: string
  syncProvider: SyncProvider
  createdAt: number
  updatedAt: number
}

export interface Workspace {
  id: string
  name: string
  icon?: string
  userId: string
  createdAt: number
  updatedAt: number
}

export interface Page {
  id: string
  workspaceId: string
  parentId?: string
  title: string
  icon?: string
  cover?: string
  content: JSONContent
  
  // Feature flags
  isLocked: boolean
  isFullWidth: boolean
  fontSize: FontSize
  fontFamily: FontFamily
  
  // Metadata
  createdAt: number
  updatedAt: number
  trashedAt?: number // Soft delete
  
  // Linking (for future bidirectional links)
  outgoingLinks?: string[]
  incomingLinks?: string[]
}
