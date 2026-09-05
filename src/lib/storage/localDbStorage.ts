import type { StateStorage } from "zustand/middleware";

const readStorageValue = (name: string): string | null => {
  try { return window.localStorage.getItem(name); } catch { return null; }
};
const writeStorageValue = (name: string, value: string): boolean => {
  try { window.localStorage.setItem(name, value); return true; } catch { return false; }
};
const deleteStorageValue = (name: string): boolean => {
  try { window.localStorage.removeItem(name); return true; } catch { return false; }
};

export const localStorageAdapter: StateStorage = {
  getItem: readStorageValue,
  setItem: writeStorageValue,
  removeItem: deleteStorageValue,
};
export const flushLocalStorageWrites = async (): Promise<void> => {};
export const getDbStorageItem = readStorageValue;
export const setDbStorageItem = writeStorageValue;
export const removeDbStorageItem = deleteStorageValue;
export const readDbStorageJSON = <T>(name: string, fallback: T): T => {
  const raw = readStorageValue(name);
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
};
export const writeDbStorageJSON = <T>(name: string, value: T): boolean =>
  writeStorageValue(name, JSON.stringify(value));
