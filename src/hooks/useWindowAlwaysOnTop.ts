import { useCallback, useEffect, useState } from "react";
import {
  getDesktopAlwaysOnTop,
  setDesktopAlwaysOnTop,
} from "@/lib/electron/alwaysOnTop";

/** 仅 Electron 有效；uTools 构建里始终为 false。 */
export function useWindowAlwaysOnTop(): {
  alwaysOnTop: boolean;
  toggleAlwaysOnTop: () => void;
} {
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);

  useEffect(() => {
    if (__HOST_TARGET__ !== "electron") return;
    let cancelled = false;
    void getDesktopAlwaysOnTop().then((value) => {
      if (!cancelled) setAlwaysOnTop(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleAlwaysOnTop = useCallback(() => {
    if (__HOST_TARGET__ !== "electron") return;
    const next = !alwaysOnTop;
    setAlwaysOnTop(next);
    void setDesktopAlwaysOnTop(next).then(
      (value) => setAlwaysOnTop(value),
      () => setAlwaysOnTop(!next),
    );
  }, [alwaysOnTop]);

  return { alwaysOnTop, toggleAlwaysOnTop };
}
