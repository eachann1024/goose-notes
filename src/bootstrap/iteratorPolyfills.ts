export function installIteratorPolyfills() {
  // Iterator Helpers (ES2025) polyfill — Electron 旧内核 (< Chrome 122) 缺 Iterator.prototype.*。
  // 旧浏览器可能缺少 Map.prototype.values().filter()，缺失时会抛
  // `s.values(...).filter is not a function`，导致 AI 调用在错误处理路径二次崩溃。
  {
    const IterProto = Object.getPrototypeOf(
      Object.getPrototypeOf([][Symbol.iterator]()),
    ) as Record<string, unknown> | null;
    if (IterProto && typeof (IterProto as any).filter !== "function") {
      const define = (name: string, value: (...args: any[]) => unknown) => {
        Object.defineProperty(IterProto, name, {
          value,
          writable: true,
          configurable: true,
        });
      };

      define(
        "filter",
        function (
          this: Iterator<unknown>,
          fn: (v: unknown, i: number) => boolean,
        ) {
          // generator 内捕获 this（Iterator 实例），generator 函数不可用箭头函数替代
          // eslint-disable-next-line @typescript-eslint/no-this-alias
          const it = this;
          let i = 0;
          return (function* () {
            for (let r = it.next(); !r.done; r = it.next()) {
              if (fn(r.value, i++)) yield r.value;
            }
          })();
        },
      );
      define(
        "map",
        function (
          this: Iterator<unknown>,
          fn: (v: unknown, i: number) => unknown,
        ) {
          // generator 内捕获 this（Iterator 实例），generator 函数不可用箭头函数替代
          // eslint-disable-next-line @typescript-eslint/no-this-alias
          const it = this;
          let i = 0;
          return (function* () {
            for (let r = it.next(); !r.done; r = it.next())
              yield fn(r.value, i++);
          })();
        },
      );
      define("take", function (this: Iterator<unknown>, limit: number) {
        // generator 内捕获 this（Iterator 实例），generator 函数不可用箭头函数替代
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const it = this;
        return (function* () {
          let n = 0;
          if (n >= limit) return;
          for (let r = it.next(); !r.done; r = it.next()) {
            yield r.value;
            if (++n >= limit) return;
          }
        })();
      });
      define("drop", function (this: Iterator<unknown>, limit: number) {
        // generator 内捕获 this（Iterator 实例），generator 函数不可用箭头函数替代
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const it = this;
        return (function* () {
          let n = 0;
          for (let r = it.next(); !r.done; r = it.next()) {
            if (n++ < limit) continue;
            yield r.value;
          }
        })();
      });
      define(
        "flatMap",
        function (
          this: Iterator<unknown>,
          fn: (v: unknown, i: number) => unknown,
        ) {
          // generator 内捕获 this（Iterator 实例），generator 函数不可用箭头函数替代
          // eslint-disable-next-line @typescript-eslint/no-this-alias
          const it = this;
          let i = 0;
          return (function* () {
            for (let r = it.next(); !r.done; r = it.next()) {
              const mapped = fn(r.value, i++) as any;
              if (mapped && typeof mapped[Symbol.iterator] === "function") {
                yield* mapped;
              } else {
                yield mapped;
              }
            }
          })();
        },
      );
      define("toArray", function (this: Iterator<unknown>) {
        const out: unknown[] = [];
        for (let r = this.next(); !r.done; r = this.next()) out.push(r.value);
        return out;
      });
      define(
        "forEach",
        function (
          this: Iterator<unknown>,
          fn: (v: unknown, i: number) => void,
        ) {
          let i = 0;
          for (let r = this.next(); !r.done; r = this.next()) fn(r.value, i++);
        },
      );
      define(
        "reduce",
        function (
          this: Iterator<unknown>,
          fn: (acc: unknown, v: unknown, i: number) => unknown,
          init?: unknown,
        ) {
          let acc = init;
          let i = 0;
          let r = this.next();
          if (arguments.length < 2) {
            if (r.done)
              throw new TypeError(
                "Reduce of empty iterator with no initial value",
              );
            acc = r.value;
            r = this.next();
          }
          for (; !r.done; r = this.next()) acc = fn(acc, r.value, i++);
          return acc;
        },
      );
      define(
        "some",
        function (
          this: Iterator<unknown>,
          fn: (v: unknown, i: number) => boolean,
        ) {
          let i = 0;
          for (let r = this.next(); !r.done; r = this.next())
            if (fn(r.value, i++)) return true;
          return false;
        },
      );
      define(
        "every",
        function (
          this: Iterator<unknown>,
          fn: (v: unknown, i: number) => boolean,
        ) {
          let i = 0;
          for (let r = this.next(); !r.done; r = this.next())
            if (!fn(r.value, i++)) return false;
          return true;
        },
      );
      define(
        "find",
        function (
          this: Iterator<unknown>,
          fn: (v: unknown, i: number) => boolean,
        ) {
          let i = 0;
          for (let r = this.next(); !r.done; r = this.next())
            if (fn(r.value, i++)) return r.value;
          return undefined;
        },
      );
    }
  }
}
