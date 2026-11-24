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
    async delete(key) {
      objects.delete(key);
    },
    async signedUrl(key) {
      if (!objects.has(key)) throw new Error("Object not found");
      return `memory://${key}`;
    },
  };
}
