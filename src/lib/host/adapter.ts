import { hostRuntime } from "./index";
import type { SublistItem, UserInfo } from "./index";

export type { SublistItem, UserInfo };

export class HostAdapter {
  static get supportsWakeHotkey(): boolean {
    return hostRuntime.supportsWakeHotkey;
  }

  static async ensureGooseFs(): Promise<void> {
    if (hostRuntime.ensureGooseFs) {
      await hostRuntime.ensureGooseFs();
    }
  }

  /**
   * Database Operations
   */
  static dbStorage = {
    getItem: (key: string): string | null => {
      return hostRuntime.dbStorage.getItem(key);
    },

    setItem: (key: string, value: string): void => {
      hostRuntime.dbStorage.setItem(key, value);
    },

    removeItem: (key: string): void => {
      hostRuntime.dbStorage.removeItem(key);
    },
  };

  /**
   * Database Operations
   */
  static db = {
    /**
     * Save a document
     * @param id Document ID
     * @param data Data to save
     */
    put: <T>(
      id: string,
      data: T,
      rev?: string,
    ): { id: string; ok: boolean; rev?: string; error?: any } => {
      return hostRuntime.db.put(id, data, rev);
    },

    /**
     * Get a document
     * @param id Document ID
     */
    get: <T>(id: string): { _id: string; _rev?: string; data: T } | null => {
      return hostRuntime.db.get(id);
    },

    /**
     * Delete a document
     * @param id Document ID
     */
    remove: (id: string): { id: string; ok: boolean; error?: any } => {
      return hostRuntime.db.remove(id);
    },

    /**
     * Get all documents with a prefix
     * @param prefix ID prefix
     */
    allDocs: <T>(
      prefix: string = "",
    ): Array<{ _id: string; _rev?: string; data: T }> => {
      return hostRuntime.db.allDocs(prefix);
    },

    /**
     * 存储附件（Electron 桌面端上限 50MB）
     * @param id 附件 ID
     * @param data 二进制数据
     * @param type MIME 类型
     */
    postAttachment: async (
      id: string,
      data: Uint8Array,
      type: string,
    ): Promise<{ id: string; ok: boolean; error?: any }> => {
      return await Promise.resolve(hostRuntime.db.postAttachment(id, data, type));
    },

    /**
     * 读取附件
     * @param id 附件 ID
     */
    getAttachment: async (id: string): Promise<Uint8Array | null> => {
      return await Promise.resolve(hostRuntime.db.getAttachment(id));
    },

    /**
     * 获取附件 MIME 类型
     * @param id 附件 ID
     */
    getAttachmentType: async (id: string): Promise<string | null> => {
      return await Promise.resolve(hostRuntime.db.getAttachmentType(id));
    },
  };

  /**
   * User Operations
   */
  static getUser(): UserInfo | null {
    return hostRuntime.getUser();
  }

  /**
   * System Integration
   */
  static copyToClipboard(text: string) {
    void hostRuntime.copyToClipboard(text);
  }

  static showNotification(body: string) {
    hostRuntime.showNotification(body);
  }

  static openUrl(url: string, useInternalBrowser = true) {
    void hostRuntime.openUrl(url, useInternalBrowser);
  }

  static async openPath(targetPath: string): Promise<boolean> {
    return Boolean(await Promise.resolve(hostRuntime.openPath(targetPath)));
  }

  /** @deprecated Use openUrl instead */
  static shellOpenExternal(url: string) {
    HostAdapter.openUrl(url, false);
  }

  /**
   * 设置全局搜索回调（sublist）
   * @param callback 搜索回调函数，接收关键词返回结果列表
   */
  static setSublistFn(callback: ((keyword: string) => SublistItem[]) | null) {
    hostRuntime.setSublistFn(callback);
  }

  /**
   * 移除全局搜索回调
   */
  static removeSublistFn() {
    // 通过设置 null 来移除回调
    HostAdapter.setSublistFn(null);
  }

  /**
   * 检查是否支持 sublist 功能
   */
  static get supportsSublist(): boolean {
    return hostRuntime.supportsSublist;
  }

  /**
   * 设置插件窗口高度
   * @param height 窗口高度（像素）
   */
  static setExpendHeight(height: number): boolean {
    return hostRuntime.setExpendHeight(height);
  }

  /**
   * 跳转到其他宿主应用
   * @param label 插件名称或 [插件名, 指令] 元组
   * @param payload 传递给目标插件的数据
   */
  static redirect(label: string | [string, string], payload?: any): boolean {
    return hostRuntime.redirect(label, payload);
  }

  static async registerWakeHotkey(shortcut: string): Promise<{ ok: boolean; error?: string }> {
    return hostRuntime.registerWakeHotkey(shortcut);
  }

  static async unregisterWakeHotkey(shortcut: string): Promise<void> {
    await hostRuntime.unregisterWakeHotkey(shortcut);
  }

  static async registerSearchHotkey(shortcut: string): Promise<{ ok: boolean; error?: string }> {
    return hostRuntime.registerSearchHotkey(shortcut);
  }

  static async unregisterSearchHotkey(shortcut: string): Promise<void> {
    await hostRuntime.unregisterSearchHotkey(shortcut);
  }

  static async registerQuicknoteHotkey(shortcut: string): Promise<{ ok: boolean; error?: string }> {
    return hostRuntime.registerQuicknoteHotkey(shortcut);
  }

  static async unregisterQuicknoteHotkey(shortcut: string): Promise<void> {
    await hostRuntime.unregisterQuicknoteHotkey(shortcut);
  }
}
