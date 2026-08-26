/** iOS özel mod / kota hatalarında localStorage fırlatmasın; Android aynı anahtarları kullanır. */
export function wrapDurableStorage(store: Storage): Storage {
  const memory = new Map<string, string>();
  return {
    get length() {
      try {
        return store.length;
      } catch {
        return memory.size;
      }
    },
    clear() {
      memory.clear();
      try {
        store.clear();
      } catch {
        /* iOS private / quota */
      }
    },
    key(index: number) {
      try {
        return store.key(index);
      } catch {
        return [...memory.keys()][index] ?? null;
      }
    },
    getItem(key: string) {
      try {
        const value = store.getItem(key);
        if (value != null) memory.set(key, value);
        return value ?? memory.get(key) ?? null;
      } catch {
        return memory.get(key) ?? null;
      }
    },
    setItem(key: string, value: string) {
      memory.set(key, value);
      try {
        store.setItem(key, value);
      } catch {
        /* iOS private / quota — bellek kopyası oturum süresince kalır */
      }
    },
    removeItem(key: string) {
      memory.delete(key);
      try {
        store.removeItem(key);
      } catch {
        /* iOS private / quota */
      }
    },
  };
}
