import type { StateStorage } from "zustand/middleware";
import { UToolsAdapter } from "../utools";

const readStorageValue = (name: string): string | null => {
  try {
    return UToolsAdapter.dbStorage.getItem(name);
  } catch (error) {
    console.error("[uToolsDbStorage] dbStorage getItem failed", name, error);
    return null;
  }
};

const writeStorageValue = (name: string, value: string): void => {
  try {
    UToolsAdapter.dbStorage.setItem(name, value);
  } catch (error) {
    console.error("[uToolsDbStorage] dbStorage setItem failed", name, error);
  }
};

const deleteStorageValue = (name: string): void => {
  try {
    UToolsAdapter.dbStorage.removeItem(name);
  } catch (error) {
    console.error("[uToolsDbStorage] dbStorage removeItem failed", name, error);
  }
};

export const uToolsStorage: StateStorage = {
  getItem: (name: string) => readStorageValue(name),
  setItem: (name: string, value: string) => writeStorageValue(name, value),
  removeItem: (name: string) => deleteStorageValue(name),
};

export const flushUToolsStorageWrites = async (): Promise<void> => {};

export const getDbStorageItem = (name: string): string | null => {
  return readStorageValue(name);
};

export const setDbStorageItem = (name: string, value: string): void => {
  writeStorageValue(name, value);
};

export const removeDbStorageItem = (name: string): void => {
  deleteStorageValue(name);
};

export const readDbStorageJSON = <T>(
  name: string,
  fallback: T,
): T => {
  const raw = readStorageValue(name);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error("[uToolsDbStorage] parse JSON failed", name, error);
    return fallback;
  }
};

export const writeDbStorageJSON = <T>(name: string, value: T): void => {
  writeStorageValue(name, JSON.stringify(value));
};
