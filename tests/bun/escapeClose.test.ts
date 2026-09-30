import { describe, expect, test } from "bun:test";
import { registerEscapeClose } from "../../src/lib/escape-close";

// Native EventTarget verifies cancellation and listener order without a browser runner.
function setup() {
  const host = new EventTarget();
  let toast = false;
  let overlay = false;
  let closed = 0;
  let dismissed = 0;
  let settings = false;
  let settingsClosed = 0;
  const root = { querySelector: (selector: string) => selector.includes('data-sonner-toast') ? toast : overlay };
  const cleanup = registerEscapeClose({ document: root as unknown as Document, window: host as unknown as Window, enabled: () => true, dismissToasts: () => { dismissed++; toast = false; }, closeContent: () => { if (settings) { settings = false; settingsClosed++; } else closed++; } });
  const fire = async (props: Record<string, unknown> = {}) => {
    const event = new Event("keydown", { cancelable: true });
    Object.assign(event, { key: "Escape", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...props });
    host.dispatchEvent(event);
    await Promise.resolve();
    return event;
  };
  return { host, fire, cleanup, setToast: (v: boolean) => { toast = v; }, setOverlay: (v: boolean) => { overlay = v; }, setSettings: (v: boolean) => { settings = v; }, get settingsClosed() { return settingsClosed; }, get closed() { return closed; }, get dismissed() { return dismissed; } };
}

describe("Escape close routing", () => {
  test("unconsumed Escape closes once; typing, modifiers, IME, repeat do not", async () => {
    const s = setup();
    for (const props of [{ key: "a" }, { ctrlKey: true }, { isComposing: true }, { keyCode: 229 }, { repeat: true }]) await s.fire(props);
    expect(s.closed).toBe(0);
    await s.fire();
    expect(s.closed).toBe(1);
    s.cleanup();
  });
  test("notification is the only dismissed layer before an open dialog", async () => {
    const s = setup(); s.setToast(true); s.setOverlay(true);
    let local = 0; s.host.addEventListener("keydown", () => local++);
    await s.fire();
    expect(s.dismissed).toBe(1); expect(s.closed).toBe(0); expect(local).toBe(0);
    s.cleanup();
  });
  test("search/dialog removed during dispatch never exposes the note", async () => {
    const s = setup(); s.setOverlay(true);
    s.host.addEventListener("keydown", () => s.setOverlay(false));
    await s.fire(); expect(s.closed).toBe(0);
    await s.fire(); expect(s.closed).toBe(1);
    s.cleanup();
  });
  test("editor, sidebar, and later window consumers prevent fallback", async () => {
    const s = setup();
    s.host.addEventListener("keydown", (event) => event.preventDefault());
    await s.fire(); expect(s.closed).toBe(0);
    s.cleanup();
  });
  test("IME cancellation still reaches the editor without closing content", async () => {
    const s = setup(); let received = 0;
    s.host.addEventListener("keydown", () => received++);
    await s.fire({ isComposing: true });
    await s.fire({ keyCode: 229 });
    expect(received).toBe(2); expect(s.closed).toBe(0);
    s.cleanup();
  });
  test("legacy IME cancel cannot dismiss an open search dialog", async () => {
    const s = setup(); s.setOverlay(true); let dismissed = 0;
    s.host.addEventListener("keydown", () => dismissed++);
    await s.fire({ keyCode: 229 });
    expect(dismissed).toBe(0); expect(s.closed).toBe(0);
    s.cleanup();
  });
  test("child layer, settings, then content each require a separate Escape", async () => {
    const s = setup(); s.setSettings(true); s.setOverlay(true);
    s.host.addEventListener("keydown", () => s.setOverlay(false));
    await s.fire(); expect(s.settingsClosed).toBe(0); expect(s.closed).toBe(0);
    await s.fire({ repeat: true }); expect(s.settingsClosed).toBe(0);
    await s.fire({ isComposing: true }); expect(s.settingsClosed).toBe(0);
    await s.fire(); expect(s.settingsClosed).toBe(1); expect(s.closed).toBe(0);
    await s.fire({ repeat: true }); expect(s.closed).toBe(0);
    await s.fire(); expect(s.closed).toBe(1);
    s.cleanup();
  });
  test("shortcut recorder keeps settings open", async () => {
    const s = setup(); s.setSettings(true);
    Object.assign(s.host, { closest: () => ({}) });
    await s.fire();
    expect(s.settingsClosed).toBe(0); expect(s.closed).toBe(0);
    s.cleanup();
  });
  test("cleanup cancels queued fallback", async () => {
    const s = setup(); const pending = s.fire(); s.cleanup(); await pending;
    expect(s.closed).toBe(0);
  });
});
