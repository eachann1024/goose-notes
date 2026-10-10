export function installRuntimePolyfills() {
  // Polyfill for older Chromium (Electron built-in)
  if (typeof globalThis.structuredClone !== "function") {
    Object.defineProperty(globalThis, "structuredClone", {
      value: function structuredClonePolyfill<T>(value: T): T {
        return JSON.parse(JSON.stringify(value)) as T;
      },
      writable: true,
      configurable: true,
    });
  }

  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID !== "function"
  ) {
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      value: function randomUUIDPolyfill() {
        const bytes = new Uint8Array(16);
        if (typeof globalThis.crypto.getRandomValues === "function") {
          globalThis.crypto.getRandomValues(bytes);
        } else {
          for (let index = 0; index < bytes.length; index += 1) {
            bytes[index] = Math.floor(Math.random() * 256);
          }
        }
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, (byte) =>
          byte.toString(16).padStart(2, "0"),
        );
        return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
      },
      writable: true,
      configurable: true,
    });
  }

  if (!(Array.prototype as any).toReversed) {
    Object.defineProperty(Array.prototype, "toReversed", {
      value: function (this: unknown[]) {
        return [...this].reverse();
      },
      writable: true,
      configurable: true,
    });
  }
}
