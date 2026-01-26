/**
 * uTools Adapter
 *
 * This class wraps all interactions with the uTools API.
 * It provides a consistent interface that works locally (via localStorage/Web APIs)
 * when running in a browser environment, and uses native uTools APIs when available.
 */

export interface UserInfo {
  avatar?: string;
  nickname: string;
  type: string;
}

/**
 * Sublist 结果项（用于 uTools 全局搜索）
 */
export interface SublistItem {
  title: string;
  description: string;
  icon: string;
  url: string;
}

export class UToolsAdapter {
  /**
   * Check if running in uTools environment
   */
  static get isUTools(): boolean {
    // @ts-ignore
    return typeof window !== "undefined" && !!window.utools;
  }

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
      if (UToolsAdapter.isUTools) {
        // @ts-ignore
        const result = window.utools.db.put({
          _id: id,
          _rev: rev,
          data: data,
        });
        return result;
      } else {
        // Web Fallback: localStorage
        try {
          const item = {
            _id: id,
            _rev: rev || Date.now().toString(), // Simple mock rev
            data: data,
          };
          localStorage.setItem(id, JSON.stringify(item));
          return { id, ok: true, rev: item._rev };
        } catch (e) {
          console.error("Web DB Put Error", e);
          return { id, ok: false, error: e };
        }
      }
    },

    /**
     * Get a document
     * @param id Document ID
     */
    get: <T>(id: string): { _id: string; _rev?: string; data: T } | null => {
      if (UToolsAdapter.isUTools) {
        // @ts-ignore
        return window.utools.db.get(id);
      } else {
        // Web Fallback
        const itemStr = localStorage.getItem(id);
        if (!itemStr) return null;
        try {
          return JSON.parse(itemStr);
        } catch {
          return null;
        }
      }
    },

    /**
     * Delete a document
     * @param id Document ID
     */
    remove: (id: string): { id: string; ok: boolean; error?: any } => {
      if (UToolsAdapter.isUTools) {
        // @ts-ignore
        return window.utools.db.remove(id);
      } else {
        // Web Fallback
        localStorage.removeItem(id);
        return { id, ok: true };
      }
    },

    /**
     * Get all documents with a prefix
     * @param prefix ID prefix
     */
    allDocs: <T>(
      prefix: string = "",
    ): Array<{ _id: string; _rev?: string; data: T }> => {
      if (UToolsAdapter.isUTools) {
        // @ts-ignore
        return window.utools.db.allDocs(prefix);
      } else {
        // Web Fallback: Iterate localStorage
        const results = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(prefix)) {
            const val = localStorage.getItem(key);
            if (val) {
              try {
                results.push(JSON.parse(val));
              } catch (e) {
                // Ignore malformed
              }
            }
          }
        }
        return results;
      }
    },
  };

  /**
   * User Operations
   */
  static getUser(): UserInfo | null {
    if (UToolsAdapter.isUTools) {
      // @ts-ignore
      return window.utools.getUser();
    }
    // Web Fallback: Mock user or null
    return {
      nickname: "Local User",
      avatar: undefined,
      type: "web",
    };
  }

  /**
   * System Integration
   */
  static copyToClipboard(text: string) {
    if (UToolsAdapter.isUTools) {
      // @ts-ignore
      window.utools.copyText(text);
    } else {
      navigator.clipboard.writeText(text);
    }
  }

  static showNotification(body: string) {
    if (UToolsAdapter.isUTools) {
      // @ts-ignore
      window.utools.showNotification(body);
    } else {
      // You might use a toast library here, but for strict "system" notification:
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("鹅的笔记", { body });
      } else {
        console.log("Notification:", body);
      }
    }
  }

  static openUrl(url: string, useInternalBrowser = true) {
    if (UToolsAdapter.isUTools) {
      const u = window as any;
      if (useInternalBrowser) {
        // 使用 uTools 内置浏览器 ubrowser
        if (typeof u.utools?.ubrowser?.goto === "function") {
          u.utools.ubrowser.goto(url).run();
        } else {
          u.utools?.shellOpenExternal?.(url);
        }
      } else {
        u.utools?.shellOpenExternal?.(url);
      }
    } else {
      window.open(url, "_blank");
    }
  }

  /** @deprecated Use openUrl instead */
  static shellOpenExternal(url: string) {
    UToolsAdapter.openUrl(url, false);
  }

  /**
   * 设置全局搜索回调（sublist）
   * @param callback 搜索回调函数，接收关键词返回结果列表
   */
  static setSublistFn(callback: ((keyword: string) => SublistItem[]) | null) {
    if (UToolsAdapter.isUTools) {
      const utools = (window as any).utools;
      // 检查 API 是否存在（sublist 可能不是所有 uTools 版本都支持）
      if (utools && typeof utools.setSublistFn === "function") {
        utools.setSublistFn(callback);
      }
    }
  }

  /**
   * 移除全局搜索回调
   */
  static removeSublistFn() {
    // 通过设置 null 来移除回调
    UToolsAdapter.setSublistFn(null);
  }

  /**
   * 检查是否支持 sublist 功能
   */
  static get supportsSublist(): boolean {
    if (!UToolsAdapter.isUTools) return false;
    const utools = (window as any).utools;
    return utools && typeof utools.setSublistFn === "function";
  }

  /**
   * 设置插件窗口高度
   * @param height 窗口高度（像素）
   */
  static setExpendHeight(height: number): boolean {
    if (UToolsAdapter.isUTools) {
      const utools = (window as any).utools;
      if (utools && typeof utools.setExpendHeight === "function") {
        return utools.setExpendHeight(height);
      }
    }
    return false;
  }

  /**
   * 跳转到其他 uTools 插件
   * @param label 插件名称或 [插件名, 指令] 元组
   * @param payload 传递给目标插件的数据
   */
  static redirect(label: string | [string, string], payload?: any): boolean {
    if (UToolsAdapter.isUTools) {
      const utools = (window as any).utools;
      if (utools && typeof utools.redirect === "function") {
        return utools.redirect(label, payload);
      }
    }
    console.warn('[Web] redirect not supported');
    return false;
  }
}
