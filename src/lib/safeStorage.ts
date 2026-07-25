/** Safe local/session storage access (Safari private mode / blocked cookies can throw). */

function storageGet(store: Storage | undefined, key: string): string | null {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function storageSet(store: Storage | undefined, key: string, value: string): void {
  try {
    store?.setItem(key, value);
  } catch {
    // Ignore quota / SecurityError
  }
}

function storageRemove(store: Storage | undefined, key: string): void {
  try {
    store?.removeItem(key);
  } catch {
    // Ignore
  }
}

function localStore(): Storage | undefined {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

function sessionStore(): Storage | undefined {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : undefined;
  } catch {
    return undefined;
  }
}

export const safeLocalStorage = {
  getItem: (key: string) => storageGet(localStore(), key),
  setItem: (key: string, value: string) => storageSet(localStore(), key, value),
  removeItem: (key: string) => storageRemove(localStore(), key),
};

export const safeSessionStorage = {
  getItem: (key: string) => storageGet(sessionStore(), key),
  setItem: (key: string, value: string) => storageSet(sessionStore(), key, value),
  removeItem: (key: string) => storageRemove(sessionStore(), key),
};
