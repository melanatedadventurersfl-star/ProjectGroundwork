const memory = new Map<string, string>();

function browserStorage() {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

const Storage = {
  async getItem(key: string) {
    const store = browserStorage();
    return store ? store.getItem(key) : memory.get(key) ?? null;
  },
  async setItem(key: string, value: string) {
    const store = browserStorage();
    if (store) store.setItem(key, value);
    else memory.set(key, value);
  },
  async removeItem(key: string) {
    const store = browserStorage();
    if (store) store.removeItem(key);
    else memory.delete(key);
  },
  async getAllKeys() {
    const store = browserStorage();
    if (!store) return Array.from(memory.keys());
    return Array.from({ length: store.length }, (_, index) => store.key(index)).filter((key): key is string => Boolean(key));
  },
  async clear() {
    const store = browserStorage();
    if (store) store.clear();
    memory.clear();
  },
};

export default Storage;
