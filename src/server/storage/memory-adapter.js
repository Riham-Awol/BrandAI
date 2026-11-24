/** In-memory storage for automated tests only. Data is lost on restart. */
export function createMemoryAdapter() {
  const objects = new Map();
  return {
    name: "memory",
    bucket: "memory",
    objects,
    async put(key, body, { contentType }) {
      objects.set(key, { body: Buffer.from(body), contentType });
    },
    async get(key) {
      const o = objects.get(key);
      return o ? { body: o.body, contentType: o.contentType } : null;
    },
    async delete(key) {
      objects.delete(key);
    },
    async signedUrl() {
      return null;
    },
  };
}
