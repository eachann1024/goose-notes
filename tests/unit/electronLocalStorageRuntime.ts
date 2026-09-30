const WEB_DB_STORAGE_KEY = "goose-note:web-db";

type StoredDoc = { _id: string; _rev: string; data: unknown };
type Attachment = { data: Uint8Array; type: string };

export function installElectronLocalStorageRuntime(options?: {
  failPut?: (id: string) => boolean;
  failWebDbWrite?: (value: string) => boolean;
  failLocalStorageSet?: (key: string) => boolean;
  failLocalStorageRemove?: (key: string) => boolean;
  attachments?: Record<string, Attachment>;
  onGetAttachment?: (id: string) => void;
}) {
  const values = new Map<string, string>();
  const attachments = new Map(Object.entries(options?.attachments ?? {}));
  let revision = 0;
  const localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (
        options?.failLocalStorageSet?.(key) ||
        (key === WEB_DB_STORAGE_KEY && options?.failWebDbWrite?.(value))
      ) {
        throw new Error("fault-injected");
      }
      if (key === WEB_DB_STORAGE_KEY && options?.failPut) {
        const next = JSON.parse(value) as Record<string, StoredDoc>;
        const previous = JSON.parse(values.get(key) ?? "{}") as Record<string, StoredDoc>;
        if (Object.keys(next).some((id) => next[id] !== previous[id] && options.failPut!(id))) {
          throw new Error("fault-injected");
        }
      }
      values.set(key, value);
    },
    removeItem: (key: string) => {
      if (options?.failLocalStorageRemove?.(key)) {
        throw new Error("fault-injected");
      }
      values.delete(key);
    },
  };
  const events = new EventTarget();
  const paths = new Map<string, Uint8Array | string>();
  const pathFor = (...segments: string[]) => segments.join("/").replaceAll("//", "/");
  const window = {
    localStorage,
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
    CustomEvent: globalThis.CustomEvent ?? class CustomEvent<T = unknown> extends Event {
      detail: T;
      constructor(type: string, init?: CustomEventInit<T>) { super(type); this.detail = init?.detail as T; }
    },
    gooseDesktop: {
      getUserDataPath: async () => "/user-data",
      joinPath: async (...segments: string[]) => pathFor(...segments),
      fsMkdir: async () => undefined,
      fsWrite: async (path: string, data: Uint8Array) => { paths.set(path, data); },
      fsWriteText: async (path: string, data: string) => { paths.set(path, data); },
      fsRead: async (path: string) => {
        const attachmentPrefix = pathFor("/user-data", "attachments") + "/";
        if (path.startsWith(attachmentPrefix) && !path.endsWith(".meta")) {
          options?.onGetAttachment?.(path.slice(attachmentPrefix.length));
        }
        return paths.get(path) as Uint8Array;
      },
      fsReadText: async (path: string) => paths.get(path) as string,
      fsExists: async (path: string) => paths.has(path),
      fsRemove: async (path: string) => { paths.delete(path); },
    },
  };
  for (const [id, attachment] of attachments) {
    const path = pathFor("/user-data", "attachments", ...id.split("/"));
    paths.set(path, attachment.data);
    paths.set(`${path}.meta`, JSON.stringify({ type: attachment.type }));
  }
  (globalThis as any).window = window;

  const docs = () => JSON.parse(values.get(WEB_DB_STORAGE_KEY) ?? "{}") as Record<string, StoredDoc>;
  const setDocs = (next: Record<string, StoredDoc>) => values.set(WEB_DB_STORAGE_KEY, JSON.stringify(next));
  const put = (id: string, data: unknown) => {
    if (options?.failPut?.(id)) return { ok: false };
    const next = docs();
    const _rev = `rev-${++revision}`;
    next[id] = { _id: id, _rev, data };
    setDocs(next);
    return { ok: true, id, rev: _rev };
  };

  return {
    values,
    attachments,
    docs: {
      get: (id: string) => docs()[id], has: (id: string) => Boolean(docs()[id]),
      set: (id: string, doc: StoredDoc) => { const next = docs(); next[id] = doc; setDocs(next); },
      delete: (id: string) => { const next = docs(); delete next[id]; setDocs(next); },
      keys: () => Object.keys(docs()).values(),
    },
    put,
  };
}

export function clearElectronLocalStorageRuntime() {
  delete (globalThis as { window?: unknown }).window;
}
